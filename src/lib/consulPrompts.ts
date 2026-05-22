/**
 * Fact-Check Consul — Shared Prompts & Schema
 *
 * Used by the Gemini, Grok, and Claude paths to ensure identically-structured
 * responses that the reconciliation engine can merge cleanly.
 */

// ── Shared JSON Schema ──────────────────────────────────────────────────

export const SINGLE_MODEL_FACT_CHECK_SCHEMA = {
    type: "object",
    additionalProperties: false,
    required: ["overall_verdict", "confidence", "summary", "claims"],
    properties: {
        overall_verdict: {
            type: "string",
            enum: ["pass", "needs_review", "fail"],
        },
        confidence: {
            type: "number",
            description: "0-1 confidence score for the overall assessment",
        },
        summary: {
            type: "string",
            description: "A 2-3 sentence editorial summary of findings",
        },
        claims: {
            type: "array",
            items: {
                type: "object",
                additionalProperties: false,
                required: ["claim", "verdict", "explanation"],
                properties: {
                    claim: {
                        type: "string",
                        description: "The exact factual claim extracted from the article",
                    },
                    verdict: {
                        type: "string",
                        enum: ["accurate", "unverifiable", "misleading", "inaccurate"],
                    },
                    explanation: {
                        type: "string",
                        description: "Why this verdict was chosen, with specific evidence",
                    },
                    sources: {
                        type: "array",
                        items: {
                            type: "object",
                            additionalProperties: false,
                            required: ["url"],
                            properties: {
                                url: { type: "string" },
                                title: { type: "string" },
                            },
                        },
                        description: "URLs of sources used to verify this claim",
                    },
                    suggested_edit: {
                        type: "string",
                        description:
                            "If the claim is misleading or inaccurate, provide a corrected version of the text that could replace the original claim in the article",
                    },
                },
            },
        },
    },
} as const;

// ── TypeScript Types ────────────────────────────────────────────────────

export type SingleModelClaimReview = {
    claim: string;
    verdict: "accurate" | "unverifiable" | "misleading" | "inaccurate";
    explanation: string;
    sources?: { url: string; title?: string }[];
    suggested_edit?: string;
};

export type SingleModelFactCheckResult = {
    overall_verdict: "pass" | "needs_review" | "fail";
    confidence: number;
    summary: string;
    claims: SingleModelClaimReview[];
};

// ── Consul (merged) Types ───────────────────────────────────────────────

export type ConsulClaimReview = {
    claim: string;
    consensus_verdict: "accurate" | "inaccurate" | "misleading" | "unverifiable" | "disputed";
    gemini_verdict?: "accurate" | "inaccurate" | "misleading" | "unverifiable";
    grok_verdict?: "accurate" | "inaccurate" | "misleading" | "unverifiable";
    claude_verdict?: "accurate" | "inaccurate" | "misleading" | "unverifiable";
    agreement: "full" | "majority" | "partial" | "split" | "single_source";
    confidence: number;
    explanation: string;
    gemini_explanation?: string;
    grok_explanation?: string;
    claude_explanation?: string;
    sources: { url: string; title?: string; from: "gemini" | "grok" | "claude" }[];
    suggested_rewrite?: string;
};

export type ConsulResult = {
    overall_verdict: "pass" | "needs_review" | "fail";
    overall_confidence: number;
    summary: string;
    models_used: {
        gemini: { model: string; status: "success" | "error"; error?: string };
        grok: { model: string; status: "success" | "error"; error?: string };
        claude: { model: string; status: "success" | "error"; error?: string };
    };
    claims: ConsulClaimReview[];
};

// ── Prompts ─────────────────────────────────────────────────────────────

export const FACT_CHECK_SYSTEM_PROMPT = [
    "You are a senior editorial fact-checker with deep expertise in verifying claims across all domains.",
    "Your job is to meticulously review a blog post / article and:",
    "",
    "1. **Identify every factual claim** — statistics, dates, percentages, named entities, legal/regulatory references, process descriptions, causal statements, and numerical data.",
    "2. **Verify each claim** using your knowledge and any search/grounding tools available to you. Cross-reference with authoritative sources.",
    "3. **Rate each claim** as one of: 'accurate', 'unverifiable', 'misleading', or 'inaccurate'.",
    "4. **Provide evidence** — explain *why* you rated each claim the way you did, citing specific facts or sources.",
    "5. **Include source URLs** when possible — if you found web sources that confirm or refute a claim, include them.",
    "6. **Suggest concrete edits** for any claim rated 'misleading' or 'inaccurate' — provide corrected text that could directly replace the problematic passage.",
    "7. **Provide an overall verdict**: 'pass' (all claims accurate), 'needs_review' (some unverifiable or minor issues), or 'fail' (contains inaccuracies).",
    "",
    "Guidelines:",
    "- Be thorough but fair. General statements and opinions should be rated 'accurate' unless demonstrably wrong.",
    "- For domain-specific content, be especially careful about process descriptions, timelines, and regulatory requirements.",
    "- Time-sensitive claims (e.g. 'currently', 'as of 2025') should be verified against the most recent information available.",
    "- Include a confidence score from 0 to 1 reflecting how confident you are in your overall assessment.",
    "- Focus on substance, not style — don't flag stylistic choices as factual errors.",
].join("\n");

/**
 * Build the user prompt from article content.
 */
export function buildFactCheckUserPrompt(
    title: string | undefined,
    excerpt: string | undefined,
    html: string
): string {
    // Strip HTML tags to give the model clean text
    const cleanText = html
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
        .replace(/<[^>]+>/g, " ")
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/\s+/g, " ")
        .trim();

    return [
        title ? `Article Title: ${title}` : "",
        excerpt ? `Excerpt: ${excerpt}` : "",
        "",
        "Full article text to fact-check:",
        "",
        cleanText,
    ]
        .filter(Boolean)
        .join("\n");
}

// ── Apply-Rewrite Prompt ────────────────────────────────────────────────

export const APPLY_REWRITE_SYSTEM_PROMPT = [
    "You are a precise editorial assistant. Your task is to apply a factual correction to an article's HTML content.",
    "",
    "Rules:",
    "1. Find the passage in the article that contains the inaccurate claim.",
    "2. Replace ONLY the relevant portion with the corrected text.",
    "3. Preserve ALL surrounding HTML structure, formatting, and styling exactly as-is.",
    "4. Make the correction read naturally in context — adjust grammar, tense, and flow as needed.",
    "5. Do NOT add editorial notes, brackets, or any indication that a change was made.",
    "6. Return the COMPLETE article HTML with the correction applied.",
    "7. If you cannot find the claim in the article, return the original HTML unchanged.",
].join("\n");
