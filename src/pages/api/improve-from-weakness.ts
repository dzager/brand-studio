/**
 * Improve from Weakness API
 *
 * Takes article HTML and a weakness description from a quality rating,
 * then uses AI to rewrite the article addressing that specific weakness.
 *
 * POST /api/improve-from-weakness
 * Body: { html, weakness, title? }
 * Returns: { html }
 */

import type { NextApiRequest, NextApiResponse } from "next";
import { getTextResponse } from "@/lib/ai-client";

const SYSTEM_PROMPT = [
    "You are a world-class editorial rewriter. Your job is to improve an article by addressing a specific weakness identified in a quality review.",
    "",
    "Rules:",
    "1. Read the FULL article carefully.",
    "2. Identify the sections most relevant to the weakness.",
    "3. Rewrite ONLY the parts that need improvement to address the weakness.",
    "4. Preserve all HTML structure, formatting, links, images, and elements that are NOT related to the weakness.",
    "5. Do NOT remove content. Improve, expand, or restructure the relevant sections.",
    "6. Maintain the same voice, tone, and style as the original article.",
    "7. Do NOT add generic filler, motivational language, or AI-sounding phrases.",
    "8. Return the COMPLETE article HTML with your improvements integrated seamlessly.",
    "9. Return ONLY the HTML. No markdown fences, no explanations, no preamble.",
].join("\n");

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse<{ html: string } | { error: string }>
) {
    try {
        if (req.method !== "POST") {
            return res.status(405).json({ error: "Method not allowed. Use POST." });
        }

        const { html, weakness, title } = req.body ?? {};

        if (!html || typeof html !== "string") {
            return res.status(400).json({ error: "html content is required" });
        }
        if (!weakness || typeof weakness !== "string") {
            return res.status(400).json({ error: "weakness description is required" });
        }

        const userPrompt = [
            title ? `Article title: "${title}"` : "",
            "",
            "Here is the article HTML:",
            "",
            "```html",
            html,
            "```",
            "",
            "WEAKNESS TO ADDRESS:",
            `"${weakness}"`,
            "",
            "Rewrite the relevant sections of the article to address this weakness.",
            "Make the improvements feel natural and integrated — not bolted on.",
            "Return ONLY the complete, improved article HTML.",
        ]
            .filter((line) => line !== undefined)
            .join("\n");

        console.log(`[improve-from-weakness] Improving: "${weakness.slice(0, 80)}…"`);

        const improvedHtml = await getTextResponse(
            "gpt-5.4",
            SYSTEM_PROMPT,
            userPrompt
        );

        // Strip any markdown fences the model might have added
        const cleaned = improvedHtml
            .replace(/^```html?\n?/i, "")
            .replace(/\n?```$/i, "")
            .trim();

        console.log(`[improve-from-weakness] Done. Output length: ${cleaned.length}`);

        return res.status(200).json({ html: cleaned });
    } catch (err) {
        console.error("API /api/improve-from-weakness error:", err);
        const message = err instanceof Error ? err.message : "Unknown server error";
        return res.status(500).json({ error: message });
    }
}
