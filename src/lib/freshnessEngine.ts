/**
 * Freshness Engine — Fact extraction, verification, and contradiction detection
 *
 * Pipeline:
 * 1. Extract discrete factual claims from page text (GPT-4.1-mini)
 * 2. Verify claims against external sources (Gemini + Google Search grounding)
 * 3. Detect internal contradictions across pages (embeddings + LLM)
 * 4. Generate structured audit report
 */

import { generateText } from "ai";
import { google } from "@ai-sdk/google";
import { getStructuredResponse, getTextResponse } from "@/lib/ai-client";
import { generateEmbedding, cosineSimilarity } from "@/lib/embeddings";
import type { CrawledFactPage, DeepCrawlResult } from "@/lib/freshnessCrawler";

// ── Types ────────────────────────────────────────────────────────────────

export type FactType = "date" | "price" | "statistic" | "process" | "general";

export type ExtractedFact = {
    claim: string;
    claim_type: FactType;
    context: string;
    confidence: number;
    specificity: "high" | "medium" | "low";
    time_sensitive: boolean;
    extracted_entities: string[];
};

export type VerificationStatus = "current" | "outdated" | "conflicting" | "unverifiable" | "likely_stale";

export type VerificationSource = {
    url: string;
    title: string;
    snippet: string;
    date?: string;
};

export type VerificationResult = {
    status: VerificationStatus;
    confidence: number;
    sources: VerificationSource[];
    explanation: string;
    suggested_correction?: string;
};

export type IssueSeverity = "critical" | "warning" | "info";

export type FreshnessIssue = {
    fact: ExtractedFact;
    status: VerificationStatus;
    severity: IssueSeverity;
    sources: VerificationSource[];
    internal_conflict?: {
        conflicting_page_url: string;
        conflicting_page_title: string;
        conflicting_claim: string;
        explanation: string;
    };
    summary: string;
    suggested_correction?: string;
};

export type FreshnessPageReport = {
    url: string;
    title: string;
    page_type: string;
    published_date?: string;
    total_facts: number;
    facts_verified: number;
    issues: FreshnessIssue[];
    health_score: number;
};

export type InternalConflict = {
    page_a_url: string;
    page_a_title: string;
    claim_a: string;
    page_b_url: string;
    page_b_title: string;
    claim_b: string;
    conflict_type: "date_conflict" | "price_conflict" | "statement_conflict" | "stale_vs_fresh";
    explanation: string;
    severity: IssueSeverity;
};

export type FreshnessAuditReport = {
    site_url: string;
    company_id: string;
    pages_crawled: number;
    total_facts_extracted: number;
    total_facts_verified: number;
    issues_found: number;
    critical_issues: number;
    overall_health: number;
    pages: FreshnessPageReport[];
    internal_conflicts: InternalConflict[];
    run_at: string;
    elapsed_ms: number;
};

// ── Constants ────────────────────────────────────────────────────────────

const EXTRACTION_MODEL = "gpt-4.1-mini";
const VERIFICATION_MODEL = "gemini-2.5-pro";
const CONTRADICTION_MODEL = "gpt-4.1-mini";

/** Max facts to verify per page (prioritized by time_sensitive + specificity) */
const MAX_FACTS_TO_VERIFY_PER_PAGE = 15;
/** Max total verifications per audit (cost control) */
const MAX_TOTAL_VERIFICATIONS = 80;
/** Similarity threshold for finding potentially contradicting claims */
const CONTRADICTION_SIMILARITY_THRESHOLD = 0.72;

// ── Fact Extraction ──────────────────────────────────────────────────────

const FactExtractionSchema = {
    type: "object",
    additionalProperties: false,
    required: ["facts"],
    properties: {
        facts: {
            type: "array",
            items: {
                type: "object",
                additionalProperties: false,
                required: ["claim", "claim_type", "context", "confidence", "specificity", "time_sensitive", "extracted_entities"],
                properties: {
                    claim: {
                        type: "string",
                        description: "The exact or near-exact factual claim as stated in the text. Keep the original wording.",
                    },
                    claim_type: {
                        type: "string",
                        enum: ["date", "price", "statistic", "process", "general"],
                        description: "date=deadlines/dates/timeframes, price=costs/fees/pricing, statistic=percentages/counts/data, process=procedures/requirements/steps, general=other verifiable facts",
                    },
                    context: {
                        type: "string",
                        description: "The surrounding sentence or paragraph providing context for this claim (1-2 sentences).",
                    },
                    confidence: {
                        type: "number",
                        description: "0-1 confidence that this is a factual claim (not an opinion, metaphor, or subjective statement). 1.0 = clearly a verifiable fact.",
                    },
                    specificity: {
                        type: "string",
                        enum: ["high", "medium", "low"],
                        description: "high=contains exact numbers/names/dates, medium=specific but not exact, low=general claim",
                    },
                    time_sensitive: {
                        type: "boolean",
                        description: "True if this fact could become outdated over time (prices change, dates pass, regulations update, statistics age).",
                    },
                    extracted_entities: {
                        type: "array",
                        items: { type: "string" },
                        description: "Key named entities: company names, product names, locations, regulatory bodies, etc.",
                    },
                },
            },
        },
    },
} as const;

const EXTRACTION_SYSTEM_PROMPT = `You are a meticulous fact-extraction analyst. Your job is to read page content and extract every discrete, verifiable factual claim.

FOCUS ESPECIALLY ON:
- Dates, deadlines, and timeframes ("applications close October 7th", "founded in 2019")
- Prices, costs, fees, and monetary figures ("starting at $299", "average cost is $4,500")
- Statistics, percentages, rankings, and numerical data ("73% of users prefer...", "ranked #1 in...")
- Process descriptions and requirements ("you must submit Form I-485", "requires 3 years of experience")
- Comparisons and competitive claims ("fastest in the industry", "more affordable than X")
- Product/service specifications ("supports up to 100 users", "available in 12 countries")

DO NOT EXTRACT:
- Opinions, subjective assessments, or marketing fluff ("we provide excellent service")
- Obvious truisms ("the sky is blue")
- Vague statements with no verifiable specifics ("we help many businesses")
- CTAs and navigation text ("click here", "learn more")

Each fact should be a single, independently verifiable claim. Split compound claims into separate facts.
Rate confidence LOW for subjective or ambiguous statements.
Mark time_sensitive=true for anything that could change: prices, dates, statistics, regulations, technology specs.`;

/**
 * Extract discrete factual claims from page text.
 */
export async function extractFacts(
    pageText: string,
    pageUrl: string,
    pageTitle: string
): Promise<ExtractedFact[]> {
    const prompt = `Extract all verifiable factual claims from this page.

Page URL: ${pageUrl}
Page Title: ${pageTitle}

Content:
${pageText.slice(0, 10000)}`;

    try {
        const result = await getStructuredResponse<{ facts: ExtractedFact[] }>(
            EXTRACTION_MODEL,
            EXTRACTION_SYSTEM_PROMPT,
            prompt,
            FactExtractionSchema as any,
            { schemaName: "fact_extraction", temperature: 0.1 }
        );
        // Filter out low-confidence extractions
        return (result.facts ?? []).filter(f => f.confidence >= 0.5);
    } catch (err) {
        console.error(`[freshness] Fact extraction failed for ${pageUrl}:`, err);
        return [];
    }
}

// ── External Verification (Gemini + Google Search Grounding) ─────────────

/**
 * Robustly extract a JSON object from text that may contain markdown fences.
 */
function extractJSON(raw: string): any {
    let text = raw.trim()
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/\s*```$/i, "")
        .trim();

    const start = text.indexOf("{");
    if (start < 0) throw new Error("No JSON object found");

    let depth = 0;
    let inString = false;
    let escaped = false;
    let end = -1;

    for (let i = start; i < text.length; i++) {
        const ch = text[i];
        if (escaped) { escaped = false; continue; }
        if (ch === "\\") { escaped = true; continue; }
        if (ch === '"' && !escaped) { inString = !inString; continue; }
        if (inString) continue;
        if (ch === "{") depth++;
        else if (ch === "}") {
            depth--;
            if (depth === 0) { end = i; break; }
        }
    }

    if (end < 0) throw new Error("Unterminated JSON");
    const jsonStr = text.slice(start, end + 1);
    try { return JSON.parse(jsonStr); }
    catch { return JSON.parse(jsonStr.replace(/,\s*([}\]])/g, "$1")); }
}

const VERIFICATION_SCHEMA = JSON.stringify({
    type: "object",
    required: ["status", "confidence", "explanation", "sources"],
    properties: {
        status: { type: "string", enum: ["current", "outdated", "conflicting", "unverifiable", "likely_stale"] },
        confidence: { type: "number", description: "0-1" },
        explanation: { type: "string", description: "Why this verdict was reached, with specific evidence." },
        sources: {
            type: "array",
            items: {
                type: "object",
                required: ["url", "title", "snippet"],
                properties: {
                    url: { type: "string" },
                    title: { type: "string" },
                    snippet: { type: "string", description: "Relevant quote or excerpt from the source" },
                    date: { type: "string", description: "Publication/update date if available" },
                },
            },
        },
        suggested_correction: { type: "string", description: "If outdated, the corrected version of the fact" },
    },
});

/**
 * Verify a single fact against external sources using Gemini + Google Search.
 */
export async function verifyFactExternal(
    fact: ExtractedFact,
    pageUrl: string
): Promise<VerificationResult> {
    const systemPrompt = `You are a fact verification specialist. Your job is to check whether a specific factual claim is still accurate by searching the web for current information.

You MUST use the google_search tool to look up the current state of the claim. Do not rely on your training data alone.

After searching, determine the claim's status:
- "current" — The fact is still accurate based on recent sources
- "outdated" — The fact was once true but has since changed (new prices, passed deadlines, updated regulations, etc.)
- "conflicting" — Multiple authoritative sources disagree about this fact
- "unverifiable" — Cannot find authoritative sources to confirm or deny
- "likely_stale" — No contradicting evidence, but the claim is old (>12 months) with no recent confirmation

IMPORTANT: Always include the actual source URLs and relevant snippets from your search results.

Respond with ONLY a JSON object matching this schema:
${VERIFICATION_SCHEMA}`;

    const userPrompt = `Verify this factual claim from ${pageUrl}:

Claim: "${fact.claim}"
Type: ${fact.claim_type}
Context: "${fact.context}"
Entities mentioned: ${fact.extracted_entities.join(", ") || "none"}

Search the web to determine if this claim is still accurate. Focus on finding the most recent, authoritative sources.`;

    try {
        const result = await generateText({
            model: google(VERIFICATION_MODEL),
            system: systemPrompt,
            prompt: userPrompt,
            tools: {
                google_search: google.tools.googleSearch({}),
            },
        });

        const parsed = extractJSON(result.text) as VerificationResult;
        return {
            status: parsed.status || "unverifiable",
            confidence: parsed.confidence ?? 0.5,
            sources: parsed.sources ?? [],
            explanation: parsed.explanation || "Verification completed.",
            suggested_correction: parsed.suggested_correction,
        };
    } catch (err) {
        console.error(`[freshness] Verification failed for claim:`, fact.claim, err);
        return {
            status: "unverifiable",
            confidence: 0,
            sources: [],
            explanation: `Verification failed: ${err instanceof Error ? err.message : "Unknown error"}`,
        };
    }
}

// ── Internal Contradiction Detection ─────────────────────────────────────

type SiteFact = ExtractedFact & {
    page_url: string;
    page_title: string;
    embedding?: number[];
};

/**
 * Find contradictions between facts across different pages on the same site.
 */
export async function findInternalConflicts(
    allFacts: SiteFact[]
): Promise<InternalConflict[]> {
    if (allFacts.length < 2) return [];

    // Only embed high-specificity, time-sensitive facts for contradiction checking
    const factsToCheck = allFacts.filter(
        f => f.time_sensitive || f.specificity === "high" || f.claim_type === "date" || f.claim_type === "price"
    );

    if (factsToCheck.length < 2) return [];

    // Generate embeddings
    console.log(`[freshness] Generating embeddings for ${factsToCheck.length} facts...`);
    const embeddingTexts = factsToCheck.map(f => `${f.claim} ${f.context}`);

    // Batch embeddings (up to 100 at a time)
    for (let i = 0; i < factsToCheck.length; i += 100) {
        const batch = embeddingTexts.slice(i, i + 100);
        const embeddings = await Promise.all(batch.map(t => generateEmbedding(t)));
        for (let j = 0; j < embeddings.length; j++) {
            factsToCheck[i + j].embedding = embeddings[j];
        }
    }

    // Find similar claim pairs across different pages
    const candidatePairs: { a: SiteFact; b: SiteFact; similarity: number }[] = [];
    for (let i = 0; i < factsToCheck.length; i++) {
        for (let j = i + 1; j < factsToCheck.length; j++) {
            // Skip pairs from the same page
            if (factsToCheck[i].page_url === factsToCheck[j].page_url) continue;
            if (!factsToCheck[i].embedding || !factsToCheck[j].embedding) continue;

            const sim = cosineSimilarity(factsToCheck[i].embedding!, factsToCheck[j].embedding!);
            if (sim >= CONTRADICTION_SIMILARITY_THRESHOLD) {
                candidatePairs.push({ a: factsToCheck[i], b: factsToCheck[j], similarity: sim });
            }
        }
    }

    // Sort by similarity descending and take top candidates
    candidatePairs.sort((a, b) => b.similarity - a.similarity);
    const topCandidates = candidatePairs.slice(0, 20);

    if (topCandidates.length === 0) return [];

    // Use LLM to check if similar claims actually contradict each other
    console.log(`[freshness] Checking ${topCandidates.length} candidate contradictions...`);

    const conflicts: InternalConflict[] = [];

    // Process in batches of 5
    for (let i = 0; i < topCandidates.length; i += 5) {
        const batch = topCandidates.slice(i, i + 5);
        const pairsText = batch.map((pair, idx) =>
            `Pair ${idx + 1}:
Page A: ${pair.a.page_url} — "${pair.a.claim}"
Page B: ${pair.b.page_url} — "${pair.b.claim}"`
        ).join("\n\n");

        const prompt = `Below are pairs of factual claims from the SAME website but DIFFERENT pages. For each pair, determine if they contradict each other.

${pairsText}

For each pair, respond with a JSON array of objects. Each object has:
- "pair_index": the pair number (1-based)
- "is_contradiction": true/false
- "conflict_type": one of "date_conflict", "price_conflict", "statement_conflict", "stale_vs_fresh" (or null if no contradiction)
- "explanation": why they contradict (or why they don't)
- "severity": "critical", "warning", or "info"

Respond ONLY with a JSON array. Look carefully for different dates, different prices, different numbers, or statements that cannot both be true simultaneously.`;

        try {
            const response = await getTextResponse(
                CONTRADICTION_MODEL,
                "You are a contradiction detection specialist. Analyze pairs of claims from the same website and identify genuine contradictions. Be precise — similar claims with different details ARE contradictions (different dates, different prices, etc.).",
                prompt,
                { temperature: 0.1 }
            );

            // Parse the response
            const cleaned = response.replace(/^```json?\s*/i, "").replace(/\s*```$/i, "").trim();
            const start = cleaned.indexOf("[");
            const end = cleaned.lastIndexOf("]");
            if (start >= 0 && end > start) {
                const arr = JSON.parse(cleaned.slice(start, end + 1));
                for (const item of arr) {
                    if (item.is_contradiction && item.pair_index) {
                        const pair = batch[item.pair_index - 1];
                        if (pair) {
                            conflicts.push({
                                page_a_url: pair.a.page_url,
                                page_a_title: pair.a.page_title,
                                claim_a: pair.a.claim,
                                page_b_url: pair.b.page_url,
                                page_b_title: pair.b.page_title,
                                claim_b: pair.b.claim,
                                conflict_type: item.conflict_type || "statement_conflict",
                                explanation: item.explanation || "These claims appear to contradict each other.",
                                severity: item.severity || "warning",
                            });
                        }
                    }
                }
            }
        } catch (err) {
            console.warn(`[freshness] Contradiction check batch failed:`, err);
        }
    }

    return conflicts;
}

// ── Audit Orchestration ──────────────────────────────────────────────────

/**
 * Prioritize which facts to verify (time-sensitive and high-specificity first).
 */
function prioritizeFacts(facts: ExtractedFact[]): ExtractedFact[] {
    return [...facts].sort((a, b) => {
        // Time-sensitive first
        if (a.time_sensitive !== b.time_sensitive) return a.time_sensitive ? -1 : 1;
        // Then by claim type priority: date > price > statistic > process > general
        const typePriority: Record<FactType, number> = { date: 5, price: 4, statistic: 3, process: 2, general: 1 };
        if (typePriority[a.claim_type] !== typePriority[b.claim_type]) {
            return typePriority[b.claim_type] - typePriority[a.claim_type];
        }
        // Then by specificity: high > medium > low
        const specPriority: Record<string, number> = { high: 3, medium: 2, low: 1 };
        return (specPriority[b.specificity] || 0) - (specPriority[a.specificity] || 0);
    });
}

/**
 * Determine severity of a verification issue.
 */
function issueSeverity(status: VerificationStatus, fact: ExtractedFact): IssueSeverity {
    if (status === "outdated") {
        if (fact.claim_type === "date" || fact.claim_type === "price") return "critical";
        if (fact.time_sensitive) return "critical";
        return "warning";
    }
    if (status === "conflicting") return "warning";
    if (status === "likely_stale") {
        if (fact.claim_type === "date" || fact.claim_type === "price") return "warning";
        return "info";
    }
    return "info";
}

/**
 * Compute page health score (0-100).
 */
function computeHealthScore(totalFacts: number, issues: FreshnessIssue[]): number {
    if (totalFacts === 0) return 100;
    const criticalWeight = 15;
    const warningWeight = 5;
    const infoWeight = 1;
    let deductions = 0;
    for (const issue of issues) {
        if (issue.severity === "critical") deductions += criticalWeight;
        else if (issue.severity === "warning") deductions += warningWeight;
        else deductions += infoWeight;
    }
    const maxDeduction = totalFacts * criticalWeight;
    const score = Math.max(0, 100 - (deductions / maxDeduction) * 100);
    return Math.round(score);
}

export type AuditProgressCallback = (phase: string, detail: string, progress: number) => void;

/**
 * Run a complete freshness audit on crawled pages.
 */
export async function runAudit(
    crawlResult: DeepCrawlResult,
    companyId: string,
    onProgress?: AuditProgressCallback,
    onPartialReport?: (report: Partial<FreshnessAuditReport>) => Promise<void>
): Promise<FreshnessAuditReport> {
    const startTime = Date.now();
    const pageReports: FreshnessPageReport[] = [];
    const allSiteFacts: SiteFact[] = [];
    let totalVerifications = 0;

    const firePartialReport = async () => {
        if (!onPartialReport) return;
        const totalFacts = allSiteFacts.length;
        const allIssues = pageReports.flatMap(p => p.issues);
        const criticalIssues = allIssues.filter(i => i.severity === "critical").length;
        const overallHealth = pageReports.length > 0
            ? Math.round(pageReports.reduce((sum, p) => sum + p.health_score, 0) / pageReports.length)
            : 100;
        await onPartialReport({
            pages_crawled: crawlResult.pages_crawled,
            total_facts_extracted: totalFacts,
            total_facts_verified: totalVerifications,
            issues_found: allIssues.length,
            critical_issues: criticalIssues,
            overall_health: overallHealth,
            pages: [...pageReports].sort((a, b) => a.health_score - b.health_score),
            internal_conflicts: [],
        });
    };

    // ── Phase 1: Extract facts from all pages ──
    console.log(`[freshness] Extracting facts from ${crawlResult.pages.length} pages...`);
    onProgress?.("extracting", `Extracting facts from ${crawlResult.pages.length} pages`, 10);

    for (let i = 0; i < crawlResult.pages.length; i++) {
        const page = crawlResult.pages[i];
        onProgress?.(
            "extracting",
            `Extracting facts: ${page.title || page.url} (${i + 1}/${crawlResult.pages.length})`,
            10 + (i / crawlResult.pages.length) * 20
        );

        const facts = await extractFacts(page.text, page.url, page.title);

        for (const fact of facts) {
            allSiteFacts.push({
                ...fact,
                page_url: page.url,
                page_title: page.title,
            });
        }

        // Seed the page report (issues populated in verification phase)
        pageReports.push({
            url: page.url,
            title: page.title,
            page_type: page.page_type,
            published_date: page.published_date,
            total_facts: facts.length,
            facts_verified: 0,
            issues: [],
            health_score: 100,
        });

        await firePartialReport();
    }

    console.log(`[freshness] Extracted ${allSiteFacts.length} total facts`);
    onProgress?.("verifying", `Verifying ${allSiteFacts.length} facts against external sources`, 30);

    // ── Phase 2: Verify facts externally ──
    // Group facts by page for structured verification
    const factsByPage = new Map<string, SiteFact[]>();
    for (const fact of allSiteFacts) {
        const arr = factsByPage.get(fact.page_url) ?? [];
        arr.push(fact);
        factsByPage.set(fact.page_url, arr);
    }

    for (const [pageUrl, pageFacts] of factsByPage) {
        const prioritized = prioritizeFacts(pageFacts);
        const toVerify = prioritized.slice(0, MAX_FACTS_TO_VERIFY_PER_PAGE);
        const pageReport = pageReports.find(r => r.url === pageUrl);
        if (!pageReport) continue;

        for (const fact of toVerify) {
            if (totalVerifications >= MAX_TOTAL_VERIFICATIONS) break;

            onProgress?.(
                "verifying",
                `Checking: "${fact.claim.slice(0, 60)}..."`,
                30 + (totalVerifications / Math.min(allSiteFacts.length, MAX_TOTAL_VERIFICATIONS)) * 40
            );

            const result = await verifyFactExternal(fact, pageUrl);
            totalVerifications++;
            pageReport.facts_verified++;

            // Only create issues for non-current facts
            if (result.status !== "current") {
                pageReport.issues.push({
                    fact,
                    status: result.status,
                    severity: issueSeverity(result.status, fact),
                    sources: result.sources,
                    summary: result.explanation,
                    suggested_correction: result.suggested_correction,
                });
            }
        }

        pageReport.health_score = computeHealthScore(pageReport.total_facts, pageReport.issues);
        await firePartialReport();
    }

    // ── Phase 3: Internal contradiction detection ──
    console.log(`[freshness] Scanning for internal contradictions...`);
    onProgress?.("contradictions", "Scanning for internal contradictions across pages", 75);

    const internalConflicts = await findInternalConflicts(allSiteFacts);

    // Add internal conflicts as issues on the relevant pages
    for (const conflict of internalConflicts) {
        const pageA = pageReports.find(r => r.url === conflict.page_a_url);
        if (pageA) {
            pageA.issues.push({
                fact: {
                    claim: conflict.claim_a,
                    claim_type: "general",
                    context: "",
                    confidence: 1,
                    specificity: "high",
                    time_sensitive: true,
                    extracted_entities: [],
                },
                status: "conflicting",
                severity: conflict.severity,
                sources: [],
                internal_conflict: {
                    conflicting_page_url: conflict.page_b_url,
                    conflicting_page_title: conflict.page_b_title,
                    conflicting_claim: conflict.claim_b,
                    explanation: conflict.explanation,
                },
                summary: conflict.explanation,
            });
            pageA.health_score = computeHealthScore(pageA.total_facts, pageA.issues);
        }
    }

    // ── Phase 4: Compile report ──
    onProgress?.("reporting", "Compiling final report", 95);

    const totalFacts = allSiteFacts.length;
    const allIssues = pageReports.flatMap(p => p.issues);
    const criticalIssues = allIssues.filter(i => i.severity === "critical").length;

    // Overall health = weighted average of page health scores
    const overallHealth = pageReports.length > 0
        ? Math.round(pageReports.reduce((sum, p) => sum + p.health_score, 0) / pageReports.length)
        : 100;

    const report: FreshnessAuditReport = {
        site_url: crawlResult.root_url,
        company_id: companyId,
        pages_crawled: crawlResult.pages_crawled,
        total_facts_extracted: totalFacts,
        total_facts_verified: totalVerifications,
        issues_found: allIssues.length,
        critical_issues: criticalIssues,
        overall_health: overallHealth,
        pages: pageReports.sort((a, b) => a.health_score - b.health_score), // worst first
        internal_conflicts: internalConflicts,
        run_at: new Date().toISOString(),
        elapsed_ms: Date.now() - startTime,
    };

    console.log(`[freshness] Audit complete: ${allIssues.length} issues found, health=${overallHealth}/100`);
    onProgress?.("complete", `Audit complete: ${allIssues.length} issues found`, 100);

    return report;
}
