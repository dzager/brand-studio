import type { NextApiRequest, NextApiResponse } from "next";
import { getSupabase } from "@/lib/supabase";
import { buildBrandEngine, type CompanyRecord } from "@/lib/buildBrandEngine";
import { compileReferenceArticles } from "@/lib/referenceArticles";
import { compileUserPrompt } from "@/lib/compileUserPrompt";
import { compileImageSystemPrompt, compileImageUserPrompt } from "@/lib/compileImagePrompt";
import {
    compileBlogSystemPrompt,
    getImageStyleCategories,
} from "@/brand/engine";
import { resolveModelId } from "@/lib/ai-client";

type EngineSummary = {
    brand_name: string;
    tagline: string;
    archetype: string;
    tone: string[];
    has_voice_profile: boolean;
    has_editorial_guidelines: boolean;
    banned_phrase_count: number;
    reference_article_count: number;
};

type PreviewResponse = {
    system: string;
    user: string;
    image_system: string;
    image_user: string;
    model: string;
    estimated_tokens?: number;
    engine_summary: EngineSummary;
};

type ErrorResponse = {
    error: string;
};



/**
 * Rough token estimate: ~4 chars per token for English text.
 */
function estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
}

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse<PreviewResponse | ErrorResponse>
) {
    try {
        if (req.method !== "POST") {
            return res.status(405).json({ error: "Method not allowed. Use POST." });
        }

        const { creation_prompt, image_style, model: requestedModel, word_count, company_id } = req.body ?? {};

        if (
            typeof creation_prompt !== "string" ||
            creation_prompt.trim().length < 5
        ) {
            return res.status(400).json({ error: "creation_prompt required (min 5 chars)" });
        }

        if (typeof company_id !== "string" || !company_id) {
            return res.status(400).json({ error: "company_id is required" });
        }

        let styleId = "default";
        const rawStyle = image_style;

        const selectedModel = resolveModelId(requestedModel);

        // Build brand engine from selected company
        const { data: companyData, error: companyErr } = await getSupabase()
            .from("companies")
            .select("*")
            .eq("id", company_id)
            .single();

        if (companyErr || !companyData) {
            return res.status(400).json({ error: "Company not found" });
        }

        const brand = buildBrandEngine(companyData as CompanyRecord);

        // Resolve style
        const brandCategories = getImageStyleCategories(brand);
        if (
            typeof rawStyle === "string" &&
            brandCategories.some((c) => c.id === rawStyle)
        ) {
            styleId = rawStyle;
        }

        let system = compileBlogSystemPrompt(brand);

        // Reference articles
        if (brand.reference_articles && brand.reference_articles.length > 0) {
            const refSection = await compileReferenceArticles(brand.reference_articles);
            if (refSection) {
                system += refSection;
            }
        }

        const user = compileUserPrompt({
            creation_prompt: creation_prompt.trim(),
            brand,
            word_count: typeof word_count === "string" && word_count ? word_count : undefined,
        });

        // Image prompt (separate step preview)
        const image_system = compileImageSystemPrompt(brand);
        const image_user = compileImageUserPrompt({
            title: `[Generated from: ${creation_prompt.trim().slice(0, 80)}]`,
            excerpt: "[Generated after article creation]",
            brand,
            styleId,
        });

        const totalText = system + user;
        const estimated_tokens = estimateTokens(totalText);

        const engine_summary: EngineSummary = {
            brand_name: brand.engine_meta.brand_name,
            tagline: brand.engine_meta.tagline,
            archetype: brand.latent_brand_profile.archetype,
            tone: brand.latent_brand_profile.tone_axes,
            has_voice_profile: !!brand.voice_profile,
            has_editorial_guidelines: !!brand.editorial_guidelines,
            banned_phrase_count: brand.rewrite_policy.banned_phrasing.length,
            reference_article_count: brand.reference_articles?.length ?? 0,
        };

        return res.status(200).json({
            system,
            user,
            image_system,
            image_user,
            model: selectedModel,
            estimated_tokens,
            engine_summary,
        });
    } catch (err) {
        console.error("API /api/preview-prompt error:", err);

        const message =
            err instanceof Error ? err.message : "Unknown server error";

        return res.status(500).json({ error: message });
    }
}
