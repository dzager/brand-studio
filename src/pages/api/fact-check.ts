import type { NextApiRequest, NextApiResponse } from "next";
import { getStructuredResponse } from "@/lib/ai-client";

const FactCheckSchema = {
    type: "object",
    additionalProperties: false,
    required: ["overall_verdict", "confidence", "claims"],
    properties: {
        overall_verdict: {
            type: "string",
            enum: ["pass", "needs_review", "fail"],
        },
        confidence: {
            type: "number",
        },
        summary: {
            type: "string",
        },
        claims: {
            type: "array",
            items: {
                type: "object",
                additionalProperties: false,
                required: ["claim", "verdict", "explanation"],
                properties: {
                    claim: { type: "string" },
                    verdict: {
                        type: "string",
                        enum: ["accurate", "unverifiable", "misleading", "inaccurate"],
                    },
                    explanation: { type: "string" },
                    suggested_edit: { type: "string" },
                },
            },
        },
    },
} as const;

type ClaimReview = {
    claim: string;
    verdict: "accurate" | "unverifiable" | "misleading" | "inaccurate";
    explanation: string;
    suggested_edit?: string;
};

type FactCheckResult = {
    overall_verdict: "pass" | "needs_review" | "fail";
    confidence: number;
    summary: string;
    claims: ClaimReview[];
};

type ErrorResponse = {
    error: string;
};

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse<FactCheckResult | ErrorResponse>
) {
    try {
        if (req.method !== "POST") {
            return res.status(405).json({ error: "Method not allowed. Use POST." });
        }

        const { title, html, excerpt } = req.body ?? {};

        if (!html || typeof html !== "string") {
            return res.status(400).json({ error: "html content is required" });
        }

        const systemPrompt = [
            "You are a senior editorial fact-checker reviewing a blog post.",
            "Your job is to:",
            "1. Identify every factual claim in the content (statistics, dates, legal references, process descriptions, etc.)",
            "2. Evaluate each claim for accuracy based on your knowledge",
            "3. Flag anything that is misleading, unverifiable, or inaccurate",
            "4. Suggest concrete edits for any problematic claims",
            "5. Provide an overall verdict: 'pass' (all claims accurate), 'needs_review' (some unverifiable or minor issues), or 'fail' (contains inaccuracies)",
            "",
            "Be thorough but fair. Mark general statements and opinions as 'accurate' unless they are demonstrably wrong.",
            "For domain-specific content, be especially careful about process descriptions, timelines, and regulatory requirements as these may change frequently.",
            "Include a confidence score from 0 to 1 indicating how confident you are in your overall assessment.",
        ].join("\n");

        const userPrompt = [
            title ? `Title: ${title}` : "",
            excerpt ? `Excerpt: ${excerpt}` : "",
            "",
            "Content to fact-check:",
            html,
        ]
            .filter(Boolean)
            .join("\n");

        const result = await getStructuredResponse<FactCheckResult>(
            "o3",
            systemPrompt,
            userPrompt,
            FactCheckSchema as any,
            { schemaName: "fact_check_result" }
        );

        return res.status(200).json(result);
    } catch (err) {
        console.error("API /api/fact-check error:", err);
        const message =
            err instanceof Error ? err.message : "Unknown server error";
        return res.status(500).json({ error: message });
    }
}
