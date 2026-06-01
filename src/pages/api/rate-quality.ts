/**
 * Rate Quality API
 *
 * Comprehensive article quality evaluation endpoint that uses Gemini 2.5 Pro
 * with Google Search grounding to assess content across SEO, GEO/AEO,
 * editorial quality, information gain, trustworthiness, and more.
 *
 * POST /api/rate-quality
 * Body: { html, title?, excerpt?, company_id? }
 * Returns: QualityRatingResult
 */

import type { NextApiRequest, NextApiResponse } from "next";
import { generateText } from "ai";
import { google } from "@ai-sdk/google";
import { extractJSON, htmlToText } from "@/lib/parse-utils";

// ── Constants ───────────────────────────────────────────────────────────

const GEMINI_MODEL = "gemini-2.5-pro";

// ── Types ───────────────────────────────────────────────────────────────

export type QualityRatingResult = {
    executive_summary: string;
    overall_score: number;
    seo_score: number;
    geo_aeo_score: number;
    editorial_quality_score: number;
    information_gain_score: number;
    trustworthiness_score: number;
    top_weaknesses: string[];
    highest_leverage_improvements: string[];
    rewrite_recommendations: string[];
    missing_content_opportunities: string[];
    cluster_expansion_ideas: string[];
    ai_detection_risks: string[];
    final_verdict: "not_competitive" | "competitive" | "highly_competitive" | "category_defining";
};

// ── JSON Schema ─────────────────────────────────────────────────────────

const QUALITY_SCHEMA = {
    type: "object",
    additionalProperties: false,
    required: [
        "executive_summary",
        "overall_score",
        "seo_score",
        "geo_aeo_score",
        "editorial_quality_score",
        "information_gain_score",
        "trustworthiness_score",
        "top_weaknesses",
        "highest_leverage_improvements",
        "rewrite_recommendations",
        "missing_content_opportunities",
        "cluster_expansion_ideas",
        "ai_detection_risks",
        "final_verdict",
    ],
    properties: {
        executive_summary: {
            type: "string",
            description: "2-4 sentence executive summary of the article's quality",
        },
        overall_score: {
            type: "number",
            description: "Overall quality score 1-10",
        },
        seo_score: {
            type: "number",
            description: "SEO optimization score 1-10",
        },
        geo_aeo_score: {
            type: "number",
            description: "GEO/AEO (Generative/Answer Engine Optimization) score 1-10",
        },
        editorial_quality_score: {
            type: "number",
            description: "Editorial quality score 1-10",
        },
        information_gain_score: {
            type: "number",
            description: "Information gain and uniqueness score 1-10",
        },
        trustworthiness_score: {
            type: "number",
            description: "Trustworthiness and E-E-A-T score 1-10",
        },
        top_weaknesses: {
            type: "array",
            items: { type: "string" },
            description: "3-5 most critical weaknesses",
        },
        highest_leverage_improvements: {
            type: "array",
            items: { type: "string" },
            description: "3-5 highest-impact improvements to make",
        },
        rewrite_recommendations: {
            type: "array",
            items: { type: "string" },
            description: "2-4 specific rewrite recommendations with before/after examples",
        },
        missing_content_opportunities: {
            type: "array",
            items: { type: "string" },
            description: "3-5 content gaps or missing sections",
        },
        cluster_expansion_ideas: {
            type: "array",
            items: { type: "string" },
            description: "3-5 supporting article or cluster expansion ideas",
        },
        ai_detection_risks: {
            type: "array",
            items: { type: "string" },
            description: "Specific passages or patterns that read as AI-generated",
        },
        final_verdict: {
            type: "string",
            enum: ["not_competitive", "competitive", "highly_competitive", "category_defining"],
            description: "Final competitive assessment",
        },
    },
};

// ── System Prompt ───────────────────────────────────────────────────────

const QUALITY_SYSTEM_PROMPT = [
    "You are a world-class editorial director, SEO strategist, GEO/AEO optimization expert, and investigative business writer.",
    "",
    "Your job is to critique and improve content to meet the standards of the best modern internet publications and AI retrieval systems.",
    "",
    "Evaluate the article across:",
    "- SEO",
    "- GEO (Generative Engine Optimization)",
    "- AEO (Answer Engine Optimization)",
    "- topical authority",
    "- semantic depth",
    "- editorial quality",
    "- information gain",
    "- AI retrieval friendliness",
    "- human readability",
    "- conversion potential",
    "- internal linking opportunities",
    "- trustworthiness",
    "",
    "Do NOT provide generic praise.",
    "",
    "Be highly critical, specific, and surgical.",
    "",
    "Assume the goal is to create:",
    "- category-defining content",
    "- extractable AI-answer-friendly passages",
    "- high-ranking search content",
    "- authoritative topical clusters",
    "- genuinely useful expert material",
    "",
    "Evaluate the article using the following framework:",
    "",
    "# 1. Information Gain",
    "- Does the article introduce meaningful insight beyond existing internet consensus?",
    "- Does it contain nuanced explanations, edge cases, operational insight, synthesis, or expert framing?",
    "- Identify weak sections that merely paraphrase generic information.",
    "- Suggest specific opportunities to add unique value.",
    "",
    "# 2. Intent Satisfaction",
    "- Does the article fully satisfy likely user intent?",
    "- What follow-up questions remain unanswered?",
    "- What related concerns, comparisons, procedural details, or edge cases are missing?",
    "- Identify where the reader would likely bounce or continue searching.",
    "",
    "# 3. Semantic Depth + Entity Coverage",
    "- Does the article comprehensively cover the semantic ecosystem around the topic?",
    "- Identify missing entities, terminology, concepts, regulations, workflows, stakeholders, or adjacent topics.",
    "- Evaluate whether the article demonstrates true topical authority.",
    "",
    "# 4. Structure + Retrieval Optimization",
    "Evaluate whether the article is optimized for:",
    "- Google featured snippets",
    "- AI retrieval systems",
    "- LLM extraction",
    "- voice assistants",
    "- answer engines",
    "",
    "Assess:",
    "- directness of opening answer",
    "- heading hierarchy",
    "- extractable passages",
    "- table opportunities",
    "- FAQ opportunities",
    "- definition clarity",
    "- chunking/scannability",
    "- paragraph density",
    "- list formatting",
    "- comparison formatting",
    "",
    "Identify sections that are difficult for AI systems to retrieve or summarize.",
    "",
    "# 5. Editorial Quality",
    "Critique:",
    "- redundancy",
    "- vagueness",
    "- filler",
    "- weak transitions",
    "- generic phrasing",
    "- AI-sounding language",
    "- lack of specificity",
    "- overwriting",
    "- weak intros/outros",
    "- passive voice",
    "- abstract language",
    "",
    "The writing should feel:",
    "- experienced",
    "- concise",
    "- authoritative",
    "- observant",
    "- specific",
    "- human",
    "- modern",
    "",
    "NOT:",
    "- corporate",
    "- fluffy",
    "- overexplained",
    "- generic",
    "- keyword stuffed",
    "- robotic",
    "",
    "# 6. Originality + Human Insight",
    "Assess whether the article demonstrates:",
    "- operator experience",
    "- lived expertise",
    "- strategic perspective",
    "- proprietary framing",
    "- differentiated thinking",
    "",
    "Identify opportunities to add:",
    "- examples",
    "- anecdotes",
    "- operational realities",
    "- counterintuitive observations",
    "- industry nuance",
    "- common mistakes",
    "- tactical insights",
    "",
    "# 7. Trust + Credibility Signals",
    "Evaluate:",
    "- citations",
    "- legal/statistical references",
    "- sourcing",
    "- transparency",
    "- factual confidence",
    "- outdated claims",
    "- unsupported assertions",
    "",
    "Suggest ways to improve E-E-A-T and trustworthiness.",
    "",
    "# 8. Internal Linking + Cluster Strategy",
    "Analyze how this article should function within a larger topical cluster.",
    "",
    "Suggest:",
    "- supporting articles",
    "- adjacent long-tail pages",
    "- glossary pages",
    "- FAQ pages",
    "- comparison pages",
    "- pillar content",
    "- internal linking opportunities",
    "",
    "Explain what semantic authority gaps still exist.",
    "",
    "# 9. GEO/AEO Optimization",
    "Assess whether the article is likely to perform well inside:",
    "- ChatGPT retrieval",
    "- Google AI Overviews",
    "- Perplexity",
    "- Claude",
    "- Gemini",
    "- voice search",
    "- AI summarization systems",
    "",
    "Evaluate:",
    "- extractability",
    "- concise definitions",
    "- semantic clarity",
    "- structured answers",
    "- entity repetition",
    "- factual density",
    "- citation-worthiness",
    "",
    "Identify sections unlikely to survive AI summarization.",
    "",
    "# 10. Competitive Assessment",
    "Assume the competing articles are from:",
    "- NerdWallet",
    "- Investopedia",
    "- HubSpot",
    "- LegalZoom",
    "- Stripe Atlas",
    "- Forbes",
    "- authoritative niche publishers",
    "",
    "Would this article realistically outperform them?",
    "Why or why not?",
    "",
    "Use your web search capabilities to look up competing content on this topic for a realistic competitive assessment.",
    "",
    "# Output Format",
    "",
    "Respond with valid JSON matching this schema exactly:",
    JSON.stringify(QUALITY_SCHEMA, null, 2),
    "",
    "Respond ONLY with the JSON object. No markdown fences, no preamble, no text after the JSON.",
    "",
    "Be direct, specific, and uncompromisingly honest.",
].join("\n");

// ── Helpers ─────────────────────────────────────────────────────────────

function wordCount(text: string): number {
    return text.split(/\s+/).filter(Boolean).length;
}

// ── API Handler ─────────────────────────────────────────────────────────

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse<QualityRatingResult | { error: string }>
) {
    try {
        if (req.method !== "POST") {
            return res.status(405).json({ error: "Method not allowed. Use POST." });
        }

        const { html, title, excerpt } = req.body ?? {};

        if (!html || typeof html !== "string") {
            return res.status(400).json({ error: "html content is required" });
        }

        // Prepare article text for analysis
        const articleText = htmlToText(html);
        const wc = wordCount(articleText);

        const userPrompt = [
            "## Article to Evaluate",
            title ? `Title: ${title}` : "",
            excerpt ? `Excerpt: ${excerpt}` : "",
            `Word count: ~${wc}`,
            "",
            articleText.slice(0, 15000),
            articleText.length > 15000 ? "\n[...truncated for analysis]" : "",
        ]
            .filter((line) => line !== undefined)
            .join("\n");

        // Run evaluation via Gemini with search grounding
        console.log(`[rate-quality] Evaluating: "${title || "Untitled"}" (~${wc} words)`);

        const result = await generateText({
            model: google(GEMINI_MODEL),
            temperature: 0,
            system: QUALITY_SYSTEM_PROMPT,
            prompt: userPrompt,
            tools: {
                google_search: google.tools.googleSearch({}),
            },
        });

        const parsed = extractJSON(result.text);

        // Clamp scores to 1-10 range
        const clamp = (n: number) => Math.max(1, Math.min(10, Math.round(n)));

        // Normalize array items — Gemini sometimes returns objects (e.g. {before, after}) instead of strings
        const toStrings = (arr: any[]): string[] =>
            (arr ?? []).map((item: any) => {
                if (typeof item === "string") return item;
                if (typeof item === "object" && item !== null) {
                    if ("before" in item && "after" in item) return `Before: ${item.before}\nAfter: ${item.after}`;
                    return JSON.stringify(item);
                }
                return String(item);
            });

        const qualityResult: QualityRatingResult = {
            executive_summary: parsed.executive_summary || "Analysis complete.",
            overall_score: clamp(parsed.overall_score),
            seo_score: clamp(parsed.seo_score),
            geo_aeo_score: clamp(parsed.geo_aeo_score),
            editorial_quality_score: clamp(parsed.editorial_quality_score),
            information_gain_score: clamp(parsed.information_gain_score),
            trustworthiness_score: clamp(parsed.trustworthiness_score),
            top_weaknesses: toStrings(parsed.top_weaknesses),
            highest_leverage_improvements: toStrings(parsed.highest_leverage_improvements),
            rewrite_recommendations: toStrings(parsed.rewrite_recommendations),
            missing_content_opportunities: toStrings(parsed.missing_content_opportunities),
            cluster_expansion_ideas: toStrings(parsed.cluster_expansion_ideas),
            ai_detection_risks: toStrings(parsed.ai_detection_risks),
            final_verdict: parsed.final_verdict || "competitive",
        };

        console.log(
            `[rate-quality] Done. Score: ${qualityResult.overall_score}/10 | Verdict: ${qualityResult.final_verdict}`
        );

        return res.status(200).json(qualityResult);
    } catch (err) {
        console.error("API /api/rate-quality error:", err);
        const message = err instanceof Error ? err.message : "Unknown server error";
        return res.status(500).json({ error: message });
    }
}
