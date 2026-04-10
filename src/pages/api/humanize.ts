import type { NextApiRequest, NextApiResponse } from "next";
import { buildBlogHumanizePrompt, buildShortContentHumanizePrompt } from "@/brand/humanizer";
import { getSupabase } from "@/lib/supabase";
import { buildBrandEngine, type CompanyRecord } from "@/lib/buildBrandEngine";
import type { BrandEngine } from "@/brand/engine";
import { getTextResponse } from "@/lib/ai-client";

type SuccessResponse = {
    html: string;
    title?: string;
    excerpt?: string;
};

type ErrorResponse = {
    error: string;
};

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

        // Optionally load brand engine for voice-aware humanization
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

        // Humanize the blog body — pass brand engine for voice matching
        const bodyPrompt = buildBlogHumanizePrompt(html, title, brand);

        const humanizedHtml = await getTextResponse("gpt-5.3-chat-latest", "", bodyPrompt, { temperature: 0.5 });
        if (!humanizedHtml) {
            throw new Error("Humanizer returned an empty response for body.");
        }

        // Humanize title and excerpt as short content
        let humanizedTitle = title;
        let humanizedExcerpt = excerpt;

        if (title && typeof title === "string") {
            const titlePrompt = buildShortContentHumanizePrompt(
                title,
                "This is a blog post title. Keep it concise, specific, and punchy. Do not use generic framing.",
                brand
            );
            const humanizedTitleResult = await getTextResponse("gpt-5.3-chat-latest", "", titlePrompt, { temperature: 0.5 });
            humanizedTitle = humanizedTitleResult || title;
        }

        if (excerpt && typeof excerpt === "string") {
            const excerptPrompt = buildShortContentHumanizePrompt(
                excerpt,
                "This is a blog post excerpt/summary. Keep it to 1-2 sentences, factual and direct. No generic framing.",
                brand
            );
            const humanizedExcerptResult = await getTextResponse("gpt-5.3-chat-latest", "", excerptPrompt, { temperature: 0.5 });
            humanizedExcerpt = humanizedExcerptResult || excerpt;
        }

        return res.status(200).json({
            html: humanizedHtml,
            title: humanizedTitle,
            excerpt: humanizedExcerpt,
        });
    } catch (err) {
        console.error("API /api/humanize error:", err);
        const message =
            err instanceof Error ? err.message : "Unknown server error";
        return res.status(500).json({ error: message });
    }
}
