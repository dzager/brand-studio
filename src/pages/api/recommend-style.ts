import type { NextApiRequest, NextApiResponse } from "next";
import { getTextResponse } from "@/lib/ai-client";

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    if (req.method !== "POST") {
        return res.status(405).json({ error: "Method not allowed" });
    }

    try {
        const { prompt, styles } = req.body;

        if (!prompt || !styles || !Array.isArray(styles) || styles.length === 0) {
            return res.status(400).json({ error: "prompt and styles[] are required" });
        }

        const styleDescriptions = styles
            .map(
                (s: any, i: number) =>
                    `${i + 1}. **${s.label}** (id: ${s.id})\n   Narrative: ${s.narrative || "N/A"}\n   Cues: ${(s.storytelling_cues || []).join(", ") || "N/A"}\n   Prompt style: ${s.image_prompt_style || "N/A"}`
            )
            .join("\n\n");

        const systemPrompt = `You are an expert creative director. Given an article topic and a list of available image styles, recommend the single best-fit style. Be concise and practical.

Respond with ONLY valid JSON in this exact format:
{"id": "<style id>", "label": "<style label>", "reason": "<1-2 sentence explanation of why this style fits the content>"}`;

        const userPrompt = `Article topic: "${prompt}"

Available image styles:

${styleDescriptions}

Which style best fits this article topic? Respond with JSON only.`;

        const raw = await getTextResponse("gpt-4.1-mini", systemPrompt, userPrompt, { temperature: 0.3 });

        // Parse JSON from response (strip markdown fences if present)
        const jsonStr = raw.replace(/^```json?\s*/i, "").replace(/\s*```$/i, "");
        const result = JSON.parse(jsonStr);

        return res.status(200).json(result);
    } catch (err) {
        console.error("API /api/recommend-style error:", err);
        const message = err instanceof Error ? err.message : "Unknown error";
        return res.status(500).json({ error: message });
    }
}
