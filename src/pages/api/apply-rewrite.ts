/**
 * Apply Rewrite API
 *
 * Uses AI to contextually integrate a fact-check correction into
 * an article's HTML, preserving formatting and natural flow.
 */

import type { NextApiRequest, NextApiResponse } from "next";
import { getTextResponse } from "@/lib/ai-client";
import { APPLY_REWRITE_SYSTEM_PROMPT } from "@/lib/consulPrompts";

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse<{ html: string } | { error: string }>
) {
    try {
        if (req.method !== "POST") {
            return res.status(405).json({ error: "Method not allowed. Use POST." });
        }

        const { html, claim, suggested_rewrite } = req.body ?? {};

        if (!html || typeof html !== "string") {
            return res.status(400).json({ error: "html content is required" });
        }
        if (!claim || typeof claim !== "string") {
            return res.status(400).json({ error: "claim is required" });
        }
        if (!suggested_rewrite || typeof suggested_rewrite !== "string") {
            return res.status(400).json({ error: "suggested_rewrite is required" });
        }

        const userPrompt = [
            "Here is the article HTML:",
            "",
            "```html",
            html,
            "```",
            "",
            "INACCURATE CLAIM TO FIX:",
            `"${claim}"`,
            "",
            "CORRECTED TEXT TO USE:",
            `"${suggested_rewrite}"`,
            "",
            "Find the passage containing the inaccurate claim and replace it with the corrected text.",
            "Make sure the correction reads naturally in context.",
            "Return ONLY the complete, corrected article HTML. No explanations, no markdown fences, just the HTML.",
        ].join("\n");

        const correctedHtml = await getTextResponse(
            "gpt-4.1",
            APPLY_REWRITE_SYSTEM_PROMPT,
            userPrompt
        );

        // Strip any markdown fences the model might have added
        const cleaned = correctedHtml
            .replace(/^```html?\n?/i, "")
            .replace(/\n?```$/i, "")
            .trim();

        return res.status(200).json({ html: cleaned });
    } catch (err) {
        console.error("API /api/apply-rewrite error:", err);
        const message = err instanceof Error ? err.message : "Unknown server error";
        return res.status(500).json({ error: message });
    }
}
