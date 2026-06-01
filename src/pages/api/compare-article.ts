/**
 * Compare Article API
 *
 * Scrapes a competitor URL and runs a structured AI comparison against
 * the Organic article. Uses Gemini 2.5 Pro with Google Search grounding
 * to assess both articles across multiple quality dimensions.
 *
 * POST /api/compare-article
 * Body: { html, title?, excerpt?, competitor_url, company_id? }
 * Returns: CompareResult
 */

import type { NextApiRequest, NextApiResponse } from "next";
import { generateText } from "ai";
import { google } from "@ai-sdk/google";
import { fetchArticleContent } from "@/lib/referenceArticles";
import { extractJSON, htmlToText } from "@/lib/parse-utils";

// ── Constants ───────────────────────────────────────────────────────────

const GEMINI_MODEL = "gemini-2.5-pro";

// ── Types ───────────────────────────────────────────────────────────────

export type CategoryScore = {
    category: string;
    organic_score: number;
    competitor_score: number;
    explanation: string;
};

export type CompareResult = {
    overall_winner: "organic" | "competitor" | "tie";
    overall_reasoning: string;
    categories: CategoryScore[];
    organic_strengths: string[];
    organic_weaknesses: string[];
    competitor_strengths: string[];
    competitor_weaknesses: string[];
    improvement_suggestions: string[];
    competitor_title: string;
    competitor_word_count: number;
    organic_word_count: number;
};

// ── JSON Schema ─────────────────────────────────────────────────────────

const COMPARE_SCHEMA = {
    type: "object",
    additionalProperties: false,
    required: [
        "overall_winner",
        "overall_reasoning",
        "categories",
        "organic_strengths",
        "organic_weaknesses",
        "competitor_strengths",
        "competitor_weaknesses",
        "improvement_suggestions",
    ],
    properties: {
        overall_winner: {
            type: "string",
            enum: ["organic", "competitor", "tie"],
        },
        overall_reasoning: {
            type: "string",
            description: "2-3 sentence explanation of the overall winner determination",
        },
        categories: {
            type: "array",
            items: {
                type: "object",
                additionalProperties: false,
                required: ["category", "organic_score", "competitor_score", "explanation"],
                properties: {
                    category: { type: "string" },
                    organic_score: { type: "number", description: "Score 0-10" },
                    competitor_score: { type: "number", description: "Score 0-10" },
                    explanation: { type: "string", description: "Brief comparison for this category" },
                },
            },
        },
        organic_strengths: {
            type: "array",
            items: { type: "string" },
            description: "3-5 specific strengths of Article A (Organic)",
        },
        organic_weaknesses: {
            type: "array",
            items: { type: "string" },
            description: "2-4 specific weaknesses of Article A (Organic)",
        },
        competitor_strengths: {
            type: "array",
            items: { type: "string" },
            description: "3-5 specific strengths of Article B (Competitor)",
        },
        competitor_weaknesses: {
            type: "array",
            items: { type: "string" },
            description: "2-4 specific weaknesses of Article B (Competitor)",
        },
        improvement_suggestions: {
            type: "array",
            items: { type: "string" },
            description: "3-5 actionable suggestions to improve Article A based on what Article B does well",
        },
    },
};

// ── System Prompt ───────────────────────────────────────────────────────

const COMPARE_SYSTEM_PROMPT = [
    "You are an expert content strategist and editorial analyst. Your job is to perform a rigorous, objective head-to-head comparison of two articles on the same topic.",
    "",
    "You will be given:",
    "- Article A (the 'Organic' article): the client's article",
    "- Article B (the 'Competitor' article): a competitor's article scraped from the web",
    "",
    "Evaluate both articles across these 6 categories, scoring each 0-10:",
    "",
    "1. **Depth & Detail** — Comprehensiveness, specificity, use of data/examples, thoroughness of coverage",
    "2. **Readability** — Clarity, flow, sentence variety, accessibility to the target audience",
    "3. **SEO Optimization** — Keyword usage, heading structure (H1/H2/H3 hierarchy), meta-friendliness, internal/external linking, featured snippet potential",
    "4. **Factual Accuracy** — Correctness of claims, use of current data, proper attribution, absence of misleading statements",
    "5. **Originality** — Unique insights, original analysis, fresh perspective vs. rehashed content",
    "6. **Structure & Flow** — Logical organization, section transitions, use of visual elements (lists, tables, callouts), scanability",
    "",
    "Rules:",
    "- Be brutally honest and objective. Do not favor Article A just because it's the client's.",
    "- Use your web search capabilities to verify factual claims in both articles.",
    "- Provide specific, evidence-based explanations for each score — cite particular passages or omissions.",
    "- Improvement suggestions must be concrete and actionable, not generic advice.",
    "- If an article is clearly superior, say so. If they're close, call it a tie.",
    "",
    "Respond with valid JSON matching this schema exactly:",
    JSON.stringify(COMPARE_SCHEMA, null, 2),
    "",
    "Respond ONLY with the JSON object. No markdown fences, no preamble, no text after the JSON.",
].join("\n");

// ── Helpers ─────────────────────────────────────────────────────────────

function wordCount(text: string): number {
    return text.split(/\s+/).filter(Boolean).length;
}

// ── API Handler ─────────────────────────────────────────────────────────

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse<CompareResult | { error: string }>
) {
    try {
        if (req.method !== "POST") {
            return res.status(405).json({ error: "Method not allowed. Use POST." });
        }

        const { html, title, excerpt, competitor_url } = req.body ?? {};

        if (!html || typeof html !== "string") {
            return res.status(400).json({ error: "html content is required" });
        }
        if (!competitor_url || typeof competitor_url !== "string") {
            return res.status(400).json({ error: "competitor_url is required" });
        }

        // Validate URL
        try {
            new URL(competitor_url);
        } catch {
            return res.status(400).json({ error: "Invalid competitor URL format" });
        }

        // ── Scrape competitor ───────────────────────────────────────────
        console.log(`[compare-article] Scraping competitor: ${competitor_url}`);
        const competitorContent = await fetchArticleContent(competitor_url);

        if (!competitorContent) {
            return res.status(422).json({
                error: "Could not extract content from the competitor URL. The page may be unreachable, require authentication, or contain insufficient text.",
            });
        }

        console.log(
            `[compare-article] Competitor scraped: "${competitorContent.title}" (${competitorContent.text.length} chars)`
        );

        // ── Prepare article texts ───────────────────────────────────────
        const organicText = htmlToText(html);
        const organicWc = wordCount(organicText);
        const competitorWc = wordCount(competitorContent.text);

        const userPrompt = [
            "## Article A (Organic)",
            title ? `Title: ${title}` : "",
            excerpt ? `Excerpt: ${excerpt}` : "",
            `Word count: ~${organicWc}`,
            "",
            organicText.slice(0, 12000),
            organicText.length > 12000 ? "\n[...truncated for analysis]" : "",
            "",
            "---",
            "",
            "## Article B (Competitor)",
            `Title: ${competitorContent.title}`,
            `Source: ${competitor_url}`,
            `Word count: ~${competitorWc}`,
            "",
            competitorContent.text.slice(0, 12000),
            competitorContent.text.length > 12000 ? "\n[...truncated for analysis]" : "",
        ]
            .filter((line) => line !== undefined)
            .join("\n");

        // ── Run comparison via Gemini with search grounding ─────────────
        console.log(`[compare-article] Running Gemini comparison...`);

        const result = await generateText({
            model: google(GEMINI_MODEL),
            system: COMPARE_SYSTEM_PROMPT,
            prompt: userPrompt,
            tools: {
                google_search: google.tools.googleSearch({}),
            },
        });

        const parsed = extractJSON(result.text);

        // Build final result with metadata
        const compareResult: CompareResult = {
            overall_winner: parsed.overall_winner,
            overall_reasoning: parsed.overall_reasoning,
            categories: parsed.categories ?? [],
            organic_strengths: parsed.organic_strengths ?? [],
            organic_weaknesses: parsed.organic_weaknesses ?? [],
            competitor_strengths: parsed.competitor_strengths ?? [],
            competitor_weaknesses: parsed.competitor_weaknesses ?? [],
            improvement_suggestions: parsed.improvement_suggestions ?? [],
            competitor_title: competitorContent.title,
            competitor_word_count: competitorWc,
            organic_word_count: organicWc,
        };

        console.log(
            `[compare-article] Done. Winner: ${compareResult.overall_winner} | Categories: ${compareResult.categories.length}`
        );

        return res.status(200).json(compareResult);
    } catch (err) {
        console.error("API /api/compare-article error:", err);
        const message = err instanceof Error ? err.message : "Unknown server error";
        return res.status(500).json({ error: message });
    }
}
