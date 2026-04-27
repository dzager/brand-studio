/**
 * Fact-Check Consul API
 *
 * Multi-model fact-checking endpoint that queries Gemini (with Google Search
 * grounding) and Grok (via Vercel AI Gateway) in parallel, then reconciles
 * their independent verdicts into a unified consensus report.
 */

import type { NextApiRequest, NextApiResponse } from "next";
import { generateText } from "ai";
import { google } from "@ai-sdk/google";
import { xai } from "@ai-sdk/xai";
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

const GEMINI_MODEL = "gemini-2.5-pro-preview-05-06";
const GROK_MODEL = "grok-4";

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
        maxTokens: 16384,
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
        maxTokens: 16384,
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

/**
 * Determine consensus verdict given two individual verdicts.
 */
function consensusVerdict(
    a: SingleModelClaimReview["verdict"],
    b: SingleModelClaimReview["verdict"]
): ConsulClaimReview["consensus_verdict"] {
    if (a === b) return a;
    // One says accurate, the other disagrees
    const severity: Record<string, number> = {
        accurate: 0,
        unverifiable: 1,
        misleading: 2,
        inaccurate: 3,
    };
    const diff = Math.abs(severity[a] - severity[b]);
    if (diff <= 1) {
        // Close enough — pick the more cautious one
        return severity[a] > severity[b] ? a : b;
    }
    // Big disagreement
    return "disputed";
}

/**
 * Determine agreement level.
 */
function agreementLevel(
    a: SingleModelClaimReview["verdict"],
    b: SingleModelClaimReview["verdict"]
): ConsulClaimReview["agreement"] {
    if (a === b) return "full";
    const severity: Record<string, number> = {
        accurate: 0,
        unverifiable: 1,
        misleading: 2,
        inaccurate: 3,
    };
    const diff = Math.abs(severity[a] - severity[b]);
    return diff <= 1 ? "partial" : "split";
}

/**
 * Merge two sets of claims into a unified consul report.
 */
function reconcileClaims(
    geminiClaims: SingleModelClaimReview[] | null,
    grokClaims: SingleModelClaimReview[] | null
): ConsulClaimReview[] {
    const results: ConsulClaimReview[] = [];

    if (geminiClaims && grokClaims) {
        // Match claims between models
        const usedGrokIndices = new Set<number>();

        for (const gc of geminiClaims) {
            let bestMatch = -1;
            let bestScore = 0;

            for (let i = 0; i < grokClaims.length; i++) {
                if (usedGrokIndices.has(i)) continue;
                const score = claimSimilarity(gc.claim, grokClaims[i].claim);
                if (score > bestScore && score >= 0.35) {
                    bestScore = score;
                    bestMatch = i;
                }
            }

            if (bestMatch >= 0) {
                // Matched pair
                usedGrokIndices.add(bestMatch);
                const gk = grokClaims[bestMatch];
                const verdict = consensusVerdict(gc.verdict, gk.verdict);
                const agreement = agreementLevel(gc.verdict, gk.verdict);

                // Merge sources
                const sources: ConsulClaimReview["sources"] = [
                    ...(gc.sources ?? []).map((s) => ({ ...s, from: "gemini" as const })),
                    ...(gk.sources ?? []).map((s) => ({ ...s, from: "grok" as const })),
                ];

                // Compute confidence
                let confidence: number;
                if (agreement === "full") confidence = 0.95;
                else if (agreement === "partial") confidence = 0.75;
                else confidence = 0.5;

                // Pick best suggested rewrite
                const suggested_rewrite =
                    verdict !== "accurate"
                        ? gc.suggested_edit || gk.suggested_edit
                        : undefined;

                // Build combined explanation
                const explanation =
                    agreement === "full"
                        ? gc.explanation
                        : `Gemini and Grok ${agreement === "partial" ? "mostly agree" : "disagree"} on this claim. See individual explanations below.`;

                results.push({
                    claim: gc.claim,
                    consensus_verdict: verdict,
                    gemini_verdict: gc.verdict,
                    grok_verdict: gk.verdict,
                    agreement,
                    confidence,
                    explanation,
                    gemini_explanation: gc.explanation,
                    grok_explanation: gk.explanation,
                    sources,
                    suggested_rewrite,
                });
            } else {
                // Gemini-only claim
                results.push({
                    claim: gc.claim,
                    consensus_verdict: gc.verdict,
                    gemini_verdict: gc.verdict,
                    agreement: "single_source",
                    confidence: 0.6,
                    explanation: gc.explanation,
                    gemini_explanation: gc.explanation,
                    sources: (gc.sources ?? []).map((s) => ({ ...s, from: "gemini" as const })),
                    suggested_rewrite: gc.suggested_edit,
                });
            }
        }

        // Unmatched Grok claims
        for (let i = 0; i < grokClaims.length; i++) {
            if (usedGrokIndices.has(i)) continue;
            const gk = grokClaims[i];
            results.push({
                claim: gk.claim,
                consensus_verdict: gk.verdict,
                grok_verdict: gk.verdict,
                agreement: "single_source",
                confidence: 0.6,
                explanation: gk.explanation,
                grok_explanation: gk.explanation,
                sources: (gk.sources ?? []).map((s) => ({ ...s, from: "grok" as const })),
                suggested_rewrite: gk.suggested_edit,
            });
        }
    } else {
        // Only one model succeeded
        const claims = geminiClaims ?? grokClaims ?? [];
        const source = geminiClaims ? "gemini" : "grok";
        for (const c of claims) {
            results.push({
                claim: c.claim,
                consensus_verdict: c.verdict,
                ...(source === "gemini"
                    ? { gemini_verdict: c.verdict, gemini_explanation: c.explanation }
                    : { grok_verdict: c.verdict, grok_explanation: c.explanation }),
                agreement: "single_source",
                confidence: 0.6,
                explanation: c.explanation,
                sources: (c.sources ?? []).map((s) => ({ ...s, from: source as "gemini" | "grok" })),
                suggested_rewrite: c.suggested_edit,
            });
        }
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

        // Fire both models in parallel
        const [geminiResult, grokResult] = await Promise.allSettled([
            checkWithGemini(userPrompt),
            checkWithGrok(userPrompt),
        ]);

        const geminiOk = geminiResult.status === "fulfilled";
        const grokOk = grokResult.status === "fulfilled";

        if (!geminiOk && !grokOk) {
            const errors = [
                `Gemini: ${(geminiResult as PromiseRejectedResult).reason?.message ?? "Unknown error"}`,
                `Grok: ${(grokResult as PromiseRejectedResult).reason?.message ?? "Unknown error"}`,
            ].join("; ");
            return res.status(502).json({ error: `Both models failed: ${errors}` });
        }

        const geminiData = geminiOk ? (geminiResult as PromiseFulfilledResult<SingleModelFactCheckResult>).value : null;
        const grokData = grokOk ? (grokResult as PromiseFulfilledResult<SingleModelFactCheckResult>).value : null;

        // Reconcile claims
        const claims = reconcileClaims(
            geminiData?.claims ?? null,
            grokData?.claims ?? null
        );

        const { verdict, confidence } = computeOverallVerdict(claims);

        // Build unified summary
        const summaryParts: string[] = [];
        if (geminiData?.summary) summaryParts.push(geminiData.summary);
        if (grokData?.summary && grokData.summary !== geminiData?.summary) {
            summaryParts.push(grokData.summary);
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
