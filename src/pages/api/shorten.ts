import type { NextApiRequest, NextApiResponse } from "next";
import { getTextResponse } from "@/lib/ai-client";
import { getSupabase } from "@/lib/supabase";
import { buildBrandEngine, type CompanyRecord } from "@/lib/buildBrandEngine";
import type { BrandEngine } from "@/brand/engine";

type SuccessResponse = {
    html: string;
    title?: string;
    excerpt?: string;
    word_count: number;
    original_word_count: number;
};

type ErrorResponse = {
    error: string;
};

function countWords(html: string): number {
    const text = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    return text ? text.split(/\s+/).length : 0;
}

function buildShortenPrompt(html: string, title: string | undefined, brand?: BrandEngine): string {
    const voiceSection = brand
        ? `\n\nBrand Voice Guidelines:\n- Tone: ${(brand as any).tone || "professional"}\n- Style: ${(brand as any).writing_style || "clear and concise"}\nMaintain this voice throughout the shortened version.`
        : "";

    return `You are an expert editorial condensation specialist. Your task is to shorten the following article to UNDER 2,000 words while preserving its value and readability.

RULES:
1. The output MUST be fewer than 2,000 words (aim for 1,400-1,800 words).
2. Preserve the core argument, key insights, and most important data points.
3. Keep the HTML structure intact — use <h2>, <h3>, <p>, <ul>/<ol>, <strong>, <em>, <a> tags as appropriate.
4. Remove redundant examples, verbose transitions, filler paragraphs, and overly detailed explanations.
5. Merge sections that overlap in content.
6. Keep any critical statistics, quotes, or unique insights.
7. Maintain SEO value — keep primary keywords naturally distributed.
8. Do NOT add new content or fabricate information.
9. Do NOT include the title in the HTML body — it is rendered separately.
10. Return ONLY the shortened HTML body. No markdown, no code fences, no commentary.
${voiceSection}

${title ? `Article Title: "${title}"\n` : ""}
Original Article HTML:
${html}`;
}

function buildShortenExcerptPrompt(excerpt: string, targetLength: number): string {
    return `Shorten this article excerpt to ${targetLength} words or fewer while keeping it compelling and accurate. Return ONLY the shortened excerpt text, nothing else.

Original excerpt:
${excerpt}`;
}

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse<SuccessResponse | ErrorResponse>
) {
    try {
        if (req.method !== "POST") {
            return res.status(405).json({ error: "Method not allowed. Use POST." });
        }

        const { html, title, excerpt, company_id } = req.body ?? {};

        if (!html || typeof html !== "string") {
            return res.status(400).json({ error: "html content is required" });
        }

        const originalWordCount = countWords(html);

        // If already under 2000 words, return as-is
        if (originalWordCount <= 2000) {
            return res.status(200).json({
                html,
                title,
                excerpt,
                word_count: originalWordCount,
                original_word_count: originalWordCount,
            });
        }

        // Optionally load brand engine for voice-aware shortening
        let brand: BrandEngine | undefined;
        if (company_id && typeof company_id === "string") {
            const { data: companyData } = await getSupabase()
                .from("companies")
                .select("*")
                .eq("id", company_id)
                .single();

            if (companyData) {
                brand = buildBrandEngine(companyData as CompanyRecord);
            }
        }

        const prompt = buildShortenPrompt(html, title, brand);
        const shortenedHtml = await getTextResponse("gpt-5.4", "", prompt, { temperature: 0.3 });

        if (!shortenedHtml || shortenedHtml.length < 100) {
            throw new Error("Shortener returned an insufficient response.");
        }

        // Clean any accidental markdown fences
        const cleanedHtml = shortenedHtml
            .replace(/^```html?\s*/i, "")
            .replace(/\s*```$/i, "")
            .trim();

        const newWordCount = countWords(cleanedHtml);

        // Shorten excerpt if provided
        let shortenedExcerpt = excerpt;
        if (excerpt && typeof excerpt === "string" && excerpt.split(/\s+/).length > 40) {
            const excerptPrompt = buildShortenExcerptPrompt(excerpt, 30);
            const result = await getTextResponse("gpt-4.1-mini", "", excerptPrompt, { temperature: 0.3 });
            if (result && result.length > 10) {
                shortenedExcerpt = result;
            }
        }

        return res.status(200).json({
            html: cleanedHtml,
            title,
            excerpt: shortenedExcerpt,
            word_count: newWordCount,
            original_word_count: originalWordCount,
        });
    } catch (err) {
        console.error("API /api/shorten error:", err);
        const message = err instanceof Error ? err.message : "Unknown server error";
        return res.status(500).json({ error: message });
    }
}
