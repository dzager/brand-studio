/**
 * Fact-Check Consul API
 *
 * Multi-model fact-checking endpoint that queries Gemini (with Google Search
 * grounding), Grok (via xAI), and Claude (via Anthropic) in parallel, then
 * reconciles their independent verdicts into a unified consensus report.
 */

import type { NextApiRequest, NextApiResponse } from "next";
import { generateText } from "ai";
import { google } from "@ai-sdk/google";
import { xai } from "@ai-sdk/xai";
import { anthropic } from "@ai-sdk/anthropic";
import {
    FACT_CHECK_SYSTEM_PROMPT,
    SINGLE_MODEL_FACT_CHECK_SCHEMA,
    buildFactCheckUserPrompt,
    type SingleModelFactCheckResult,
    type SingleModelClaimReview,
    type ConsulResult,
    type ConsulClaimReview,
} from "@/lib/consulPrompts";

// ── Constants ───────────────────────────────────────────────────────────

const GEMINI_MODEL = "gemini-2.5-pro";
const GROK_MODEL = "grok-4";
const CLAUDE_MODEL = "claude-sonnet-4-20250514";

type ModelName = "gemini" | "grok" | "claude";

// ── Helpers ─────────────────────────────────────────────────────────────

/**
 * Robustly extract a JSON object from text that may contain markdown fences,
 * preamble, or trailing content. Uses balanced-brace counting so it won't
 * break on nested objects/arrays.
 */
function extractJSON(raw: string): any {
    // Strip markdown code fences
    let text = raw.trim()
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/\s*```$/i, "")
        .trim();

    // Find the first '{' character
    const start = text.indexOf("{");
    if (start < 0) throw new Error("No JSON object found in model response.");

    // Walk forward with balanced brace counting, respecting strings
    let depth = 0;
    let inString = false;
    let escaped = false;
    let end = -1;

    for (let i = start; i < text.length; i++) {
        const ch = text[i];

        if (escaped) { escaped = false; continue; }
        if (ch === "\\") { escaped = true; continue; }

        if (ch === '"' && !escaped) {
            inString = !inString;
            continue;
        }

        if (inString) continue;

        if (ch === "{") depth++;
        else if (ch === "}") {
            depth--;
            if (depth === 0) { end = i; break; }
        }
    }

    if (end < 0) throw new Error("Unterminated JSON object in model response.");

    const jsonStr = text.slice(start, end + 1);

    try {
        return JSON.parse(jsonStr);
    } catch {
        // Attempt repair: trailing commas before ] or }
        const repaired = jsonStr
            .replace(/,\s*([}\]])/g, "$1");
        return JSON.parse(repaired);
    }
}

/**
 * Run fact-check via Gemini with Google Search grounding.
 * Uses google.tools.googleSearch() for web-grounded verification.
 */
async function checkWithGemini(
    userPrompt: string
): Promise<SingleModelFactCheckResult> {
    const result = await generateText({
        model: google(GEMINI_MODEL),
        system: FACT_CHECK_SYSTEM_PROMPT + "\n\nIMPORTANT: You MUST respond with valid JSON matching this schema exactly:\n" + JSON.stringify(SINGLE_MODEL_FACT_CHECK_SCHEMA, null, 2) + "\n\nRespond ONLY with the JSON object. No markdown fences, no preamble, no text after the JSON.",
        prompt: userPrompt,
        tools: {
            google_search: google.tools.googleSearch({}),
        },
    });

    return extractJSON(result.text) as SingleModelFactCheckResult;
}

/**
 * Run fact-check via Grok through the Vercel AI Gateway.
 * Uses the gateway string format — authenticated via AI_GATEWAY_API_KEY.
 */
async function checkWithGrok(
    userPrompt: string
): Promise<SingleModelFactCheckResult> {
    const result = await generateText({
        model: xai(GROK_MODEL),
        system: FACT_CHECK_SYSTEM_PROMPT + "\n\nIMPORTANT: You MUST respond with valid JSON matching this schema exactly:\n" + JSON.stringify(SINGLE_MODEL_FACT_CHECK_SCHEMA, null, 2) + "\n\nRespond ONLY with the JSON object. No markdown fences, no preamble, no text after the JSON.",
        prompt: userPrompt,
    });

    return extractJSON(result.text) as SingleModelFactCheckResult;
}

/**
 * Run fact-check via Claude (Anthropic).
 */
async function checkWithClaude(
    userPrompt: string
): Promise<SingleModelFactCheckResult> {
    const result = await generateText({
        model: anthropic(CLAUDE_MODEL),
        system: FACT_CHECK_SYSTEM_PROMPT + "\n\nIMPORTANT: You MUST respond with valid JSON matching this schema exactly:\n" + JSON.stringify(SINGLE_MODEL_FACT_CHECK_SCHEMA, null, 2) + "\n\nRespond ONLY with the JSON object. No markdown fences, no preamble, no text after the JSON.",
        prompt: userPrompt,
    });

    return extractJSON(result.text) as SingleModelFactCheckResult;
}

// ── Claim Matching & Reconciliation ─────────────────────────────────────

/**
 * Simple word-overlap similarity between two claim strings.
 * Returns 0-1 score.
 */
function claimSimilarity(a: string, b: string): number {
    const wordsA = new Set(a.toLowerCase().replace(/[^\w\s]/g, "").split(/\s+/).filter(Boolean));
    const wordsB = new Set(b.toLowerCase().replace(/[^\w\s]/g, "").split(/\s+/).filter(Boolean));
    if (wordsA.size === 0 || wordsB.size === 0) return 0;
    let overlap = 0;
    for (const w of wordsA) if (wordsB.has(w)) overlap++;
    return (2 * overlap) / (wordsA.size + wordsB.size);
}

const SEVERITY: Record<string, number> = {
    accurate: 0,
    unverifiable: 1,
    misleading: 2,
    inaccurate: 3,
};

/**
 * Determine consensus verdict from an array of individual verdicts (2 or 3).
 */
function consensusVerdict(
    verdicts: SingleModelClaimReview["verdict"][]
): ConsulClaimReview["consensus_verdict"] {
    if (verdicts.length === 0) return "unverifiable";
    if (verdicts.length === 1) return verdicts[0];

    // Count occurrences
    const counts: Record<string, number> = {};
    for (const v of verdicts) counts[v] = (counts[v] ?? 0) + 1;

    // Unanimous
    if (Object.keys(counts).length === 1) return verdicts[0];

    // Majority (2-of-3 or more)
    for (const [verdict, count] of Object.entries(counts)) {
        if (count >= 2) return verdict as SingleModelClaimReview["verdict"];
    }

    // No majority — pick the most cautious (highest severity)
    const maxSeverity = Math.max(...verdicts.map(v => SEVERITY[v]));
    const maxDiff = maxSeverity - Math.min(...verdicts.map(v => SEVERITY[v]));
    if (maxDiff <= 1) {
        return verdicts.find(v => SEVERITY[v] === maxSeverity)!;
    }
    return "disputed";
}

/**
 * Determine agreement level from an array of verdicts.
 */
function agreementLevel(
    verdicts: SingleModelClaimReview["verdict"][]
): ConsulClaimReview["agreement"] {
    if (verdicts.length <= 1) return "single_source";

    const unique = new Set(verdicts);
    if (unique.size === 1) return "full";

    // Check for majority (2-of-3 agree)
    const counts: Record<string, number> = {};
    for (const v of verdicts) counts[v] = (counts[v] ?? 0) + 1;
    const hasMajority = Object.values(counts).some(c => c >= 2);

    if (hasMajority && verdicts.length >= 3) return "majority";

    // 2-model case or 3-way split
    const severities = verdicts.map(v => SEVERITY[v]);
    const diff = Math.max(...severities) - Math.min(...severities);
    return diff <= 1 ? "partial" : "split";
}

type TaggedClaim = SingleModelClaimReview & { model: ModelName };

/**
 * Merge claims from all available models into a unified consul report.
 * Uses greedy best-match clustering: for each claim, find the best-matching
 * claim from other models (similarity >= 0.35) and group them.
 */
function reconcileClaims(
    modelResults: { model: ModelName; claims: SingleModelClaimReview[] | null }[]
): ConsulClaimReview[] {
    // Flatten all claims with model tags
    const allTagged: TaggedClaim[] = [];
    for (const mr of modelResults) {
        if (!mr.claims) continue;
        for (const c of mr.claims) {
            allTagged.push({ ...c, model: mr.model });
        }
    }

    if (allTagged.length === 0) return [];

    // Greedy clustering
    const used = new Set<number>();
    const clusters: TaggedClaim[][] = [];

    for (let i = 0; i < allTagged.length; i++) {
        if (used.has(i)) continue;
        used.add(i);
        const cluster: TaggedClaim[] = [allTagged[i]];
        const usedModels = new Set<ModelName>([allTagged[i].model]);

        // Find best match from each other model
        for (let j = i + 1; j < allTagged.length; j++) {
            if (used.has(j)) continue;
            if (usedModels.has(allTagged[j].model)) continue;
            const score = claimSimilarity(allTagged[i].claim, allTagged[j].claim);
            if (score >= 0.35) {
                // Check this is the best available match for this model
                let isBest = true;
                for (let k = j + 1; k < allTagged.length; k++) {
                    if (used.has(k) || allTagged[k].model !== allTagged[j].model) continue;
                    if (claimSimilarity(allTagged[i].claim, allTagged[k].claim) > score) {
                        isBest = false;
                        break;
                    }
                }
                if (isBest) {
                    used.add(j);
                    cluster.push(allTagged[j]);
                    usedModels.add(allTagged[j].model);
                }
            }
        }

        clusters.push(cluster);
    }

    // Build ConsulClaimReview for each cluster
    const results: ConsulClaimReview[] = [];

    for (const cluster of clusters) {
        const verdicts = cluster.map(c => c.verdict);
        const verdict = consensusVerdict(verdicts);
        const agreement = agreementLevel(verdicts);

        // Merge sources
        const sources: ConsulClaimReview["sources"] = [];
        for (const c of cluster) {
            for (const s of c.sources ?? []) {
                sources.push({ ...s, from: c.model });
            }
        }

        // Confidence based on agreement
        let confidence: number;
        if (agreement === "full") confidence = 0.97;
        else if (agreement === "majority") confidence = 0.90;
        else if (agreement === "partial") confidence = 0.75;
        else if (agreement === "split") confidence = 0.5;
        else confidence = 0.6; // single_source

        // Model-specific fields
        const byModel: Record<ModelName, TaggedClaim | undefined> = {
            gemini: cluster.find(c => c.model === "gemini"),
            grok: cluster.find(c => c.model === "grok"),
            claude: cluster.find(c => c.model === "claude"),
        };

        // Build explanation
        const modelNames = cluster.map(c => c.model.charAt(0).toUpperCase() + c.model.slice(1));
        let explanation: string;
        if (agreement === "full") {
            explanation = cluster[0].explanation;
        } else if (agreement === "majority") {
            explanation = `${modelNames.join(", ")} reviewed this claim — majority agree. See individual reasoning below.`;
        } else if (cluster.length === 1) {
            explanation = cluster[0].explanation;
        } else {
            explanation = `${modelNames.join(" and ")} ${agreement === "partial" ? "mostly agree" : "disagree"} on this claim. See individual explanations below.`;
        }

        // Pick best suggested rewrite
        const suggested_rewrite =
            verdict !== "accurate"
                ? cluster.find(c => c.suggested_edit)?.suggested_edit
                : undefined;

        results.push({
            claim: cluster[0].claim,
            consensus_verdict: verdict,
            gemini_verdict: byModel.gemini?.verdict,
            grok_verdict: byModel.grok?.verdict,
            claude_verdict: byModel.claude?.verdict,
            agreement,
            confidence,
            explanation,
            gemini_explanation: byModel.gemini?.explanation,
            grok_explanation: byModel.grok?.explanation,
            claude_explanation: byModel.claude?.explanation,
            sources,
            suggested_rewrite,
        });
    }

    return results;
}

/**
 * Compute overall verdict from reconciled claims.
 */
function computeOverallVerdict(claims: ConsulClaimReview[]): {
    verdict: ConsulResult["overall_verdict"];
    confidence: number;
} {
    if (claims.length === 0) return { verdict: "pass", confidence: 1 };

    const hasInaccurate = claims.some(
        (c) => c.consensus_verdict === "inaccurate" || c.consensus_verdict === "disputed"
    );
    const hasMisleading = claims.some((c) => c.consensus_verdict === "misleading");
    const hasUnverifiable = claims.some((c) => c.consensus_verdict === "unverifiable");

    let verdict: ConsulResult["overall_verdict"];
    if (hasInaccurate) verdict = "fail";
    else if (hasMisleading || hasUnverifiable) verdict = "needs_review";
    else verdict = "pass";

    const avgConfidence =
        claims.reduce((sum, c) => sum + c.confidence, 0) / claims.length;

    return { verdict, confidence: Math.round(avgConfidence * 100) / 100 };
}

// ── API Handler ─────────────────────────────────────────────────────────

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse<ConsulResult | { error: string }>
) {
    try {
        if (req.method !== "POST") {
            return res.status(405).json({ error: "Method not allowed. Use POST." });
        }

        const { title, html, excerpt } = req.body ?? {};

        if (!html || typeof html !== "string") {
            return res.status(400).json({ error: "html content is required" });
        }

        const userPrompt = buildFactCheckUserPrompt(title, excerpt, html);

        // Fire all models in parallel (skip if API key missing)
        const hasXaiKey = !!process.env.XAI_API_KEY;
        const hasAnthropicKey = !!process.env.ANTHROPIC_API_KEY;

        const [geminiResult, grokResult, claudeResult] = await Promise.allSettled([
            checkWithGemini(userPrompt),
            hasXaiKey
                ? checkWithGrok(userPrompt)
                : Promise.reject(new Error("XAI_API_KEY not configured — skipping Grok")),
            hasAnthropicKey
                ? checkWithClaude(userPrompt)
                : Promise.reject(new Error("ANTHROPIC_API_KEY not configured — skipping Claude")),
        ]);

        const geminiOk = geminiResult.status === "fulfilled";
        const grokOk = grokResult.status === "fulfilled";
        const claudeOk = claudeResult.status === "fulfilled";

        if (!geminiOk && !grokOk && !claudeOk) {
            const errors = [
                `Gemini: ${(geminiResult as PromiseRejectedResult).reason?.message ?? "Unknown error"}`,
                `Grok: ${(grokResult as PromiseRejectedResult).reason?.message ?? "Unknown error"}`,
                `Claude: ${(claudeResult as PromiseRejectedResult).reason?.message ?? "Unknown error"}`,
            ].join("; ");
            return res.status(502).json({ error: `All models failed: ${errors}` });
        }

        const geminiData = geminiOk ? (geminiResult as PromiseFulfilledResult<SingleModelFactCheckResult>).value : null;
        const grokData = grokOk ? (grokResult as PromiseFulfilledResult<SingleModelFactCheckResult>).value : null;
        const claudeData = claudeOk ? (claudeResult as PromiseFulfilledResult<SingleModelFactCheckResult>).value : null;

        // ── Diagnostic logging ──────────────────────────────────────────
        const successCount = [geminiOk, grokOk, claudeOk].filter(Boolean).length;
        console.log(`[fact-check-consul] Models: ${successCount}/3 succeeded | gemini=${geminiOk} grok=${grokOk} claude=${claudeOk}`);
        if (!geminiOk) console.log("[fact-check-consul] Gemini error:", (geminiResult as PromiseRejectedResult).reason?.message);
        if (!grokOk) console.log("[fact-check-consul] Grok error:", (grokResult as PromiseRejectedResult).reason?.message);
        if (!claudeOk) console.log("[fact-check-consul] Claude error:", (claudeResult as PromiseRejectedResult).reason?.message);
        console.log(`[fact-check-consul] Claims: gemini=${geminiData?.claims?.length ?? 0} grok=${grokData?.claims?.length ?? 0} claude=${claudeData?.claims?.length ?? 0}`);

        // Reconcile claims across all models
        const claims = reconcileClaims([
            { model: "gemini", claims: geminiData?.claims ?? null },
            { model: "grok", claims: grokData?.claims ?? null },
            { model: "claude", claims: claudeData?.claims ?? null },
        ]);

        // Log reconciliation results
        const matchedCount = claims.filter(c => c.agreement !== "single_source").length;
        const singleCount = claims.filter(c => c.agreement === "single_source").length;
        console.log(`[fact-check-consul] Reconciled: ${claims.length} total | ${matchedCount} matched | ${singleCount} single_source`);
        claims.forEach((c, i) => console.log(`  claim[${i}]: agreement=${c.agreement} confidence=${c.confidence} verdict=${c.consensus_verdict}`));

        const { verdict, confidence } = computeOverallVerdict(claims);

        // Build unified summary
        const summaryParts: string[] = [];
        if (geminiData?.summary) summaryParts.push(geminiData.summary);
        if (grokData?.summary && grokData.summary !== geminiData?.summary) {
            summaryParts.push(grokData.summary);
        }
        if (claudeData?.summary && claudeData.summary !== geminiData?.summary && claudeData.summary !== grokData?.summary) {
            summaryParts.push(claudeData.summary);
        }

        const consulResult: ConsulResult = {
            overall_verdict: verdict,
            overall_confidence: confidence,
            summary: summaryParts.join(" ") || "Fact-check analysis complete.",
            models_used: {
                gemini: {
                    model: GEMINI_MODEL,
                    status: geminiOk ? "success" : "error",
                    ...(geminiOk ? {} : { error: (geminiResult as PromiseRejectedResult).reason?.message }),
                },
                grok: {
                    model: GROK_MODEL,
                    status: grokOk ? "success" : "error",
                    ...(grokOk ? {} : { error: (grokResult as PromiseRejectedResult).reason?.message }),
                },
                claude: {
                    model: CLAUDE_MODEL,
                    status: claudeOk ? "success" : "error",
                    ...(claudeOk ? {} : { error: (claudeResult as PromiseRejectedResult).reason?.message }),
                },
            },
            claims,
        };

        return res.status(200).json(consulResult);
    } catch (err) {
        console.error("API /api/fact-check-consul error:", err);
        const message = err instanceof Error ? err.message : "Unknown server error";
        return res.status(500).json({ error: message });
    }
}
