/**
 * Batch Apply Rewrite API
 *
 * Applies multiple fact-check corrections to an article's HTML in a single
 * AI pass. This avoids race conditions from concurrent single rewrites and
 * ensures overlapping sections are handled coherently.
 */

import type { NextApiRequest, NextApiResponse } from "next";
import { getTextResponse } from "@/lib/ai-client";

const BATCH_REWRITE_SYSTEM_PROMPT = [
    "You are a precise editorial assistant. Your task is to apply MULTIPLE factual corrections to an article's HTML content in a single pass.",
    "",
    "Rules:",
    "1. Apply ALL corrections listed below to the article HTML.",
    "2. For each correction, find the passage containing the inaccurate claim and replace it with the corrected text.",
    "3. If two corrections target the same passage or overlapping text, merge them intelligently — apply the correction that produces the most accurate and naturally-reading result.",
    "4. Preserve ALL surrounding HTML structure, formatting, and styling exactly as-is.",
    "5. Make each correction read naturally in context — adjust grammar, tense, and flow as needed.",
    "6. Do NOT add editorial notes, brackets, or any indication that changes were made.",
    "7. Return the COMPLETE article HTML with ALL corrections applied.",
    "8. If you cannot find a particular claim in the article, skip it and apply the rest.",
].join("\n");

type CorrectionItem = {
    claim: string;
    suggested_rewrite: string;
};

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse<{ html: string; applied_count: number } | { error: string }>
) {
    try {
        if (req.method !== "POST") {
            return res.status(405).json({ error: "Method not allowed. Use POST." });
        }

        const { html, corrections } = req.body ?? {};

        if (!html || typeof html !== "string") {
            return res.status(400).json({ error: "html content is required" });
        }
        if (!Array.isArray(corrections) || corrections.length === 0) {
            return res.status(400).json({ error: "corrections array is required and must not be empty" });
        }

        // Validate each correction
        for (let i = 0; i < corrections.length; i++) {
            const c = corrections[i] as CorrectionItem;
            if (!c.claim || !c.suggested_rewrite) {
                return res.status(400).json({
                    error: `Correction at index ${i} is missing claim or suggested_rewrite`,
                });
            }
        }

        // Build the corrections list
        const correctionLines = (corrections as CorrectionItem[]).map((c, i) => [
            `--- CORRECTION ${i + 1} of ${corrections.length} ---`,
            `INACCURATE CLAIM: "${c.claim}"`,
            `CORRECTED TEXT: "${c.suggested_rewrite}"`,
            "",
        ].join("\n")).join("\n");

        const userPrompt = [
            "Here is the article HTML:",
            "",
            "```html",
            html,
            "```",
            "",
            `You need to apply ${corrections.length} correction(s) to this article:`,
            "",
            correctionLines,
            "Find each passage containing the inaccurate claim and replace it with the corrected text.",
            "If two corrections target overlapping text, merge them into a single coherent correction.",
            "Make sure all corrections read naturally in context.",
            "Return ONLY the complete, corrected article HTML. No explanations, no markdown fences, just the HTML.",
        ].join("\n");

        const correctedHtml = await getTextResponse(
            "gpt-5.4",
            BATCH_REWRITE_SYSTEM_PROMPT,
            userPrompt
        );

        // Strip any markdown fences the model might have added
        const cleaned = correctedHtml
            .replace(/^```html?\n?/i, "")
            .replace(/\n?```$/i, "")
            .trim();

        return res.status(200).json({
            html: cleaned,
            applied_count: corrections.length,
        });
    } catch (err) {
        console.error("API /api/apply-rewrite-batch error:", err);
        const message = err instanceof Error ? err.message : "Unknown server error";
        return res.status(500).json({ error: message });
    }
}
