import type { NextApiRequest, NextApiResponse } from "next";
import { getImageStyleCategories } from "@/brand/engine";
import { getSupabase } from "@/lib/supabase";
import { buildBrandEngine, type CompanyRecord } from "@/lib/buildBrandEngine";
import { generateImageBase64 } from "@/lib/ai-client";
import { generateCompositeImage } from "@/lib/compositeEngine";

type SuccessResponse = {
    image_base64: string;
    final_prompt: string;
    base_prompt: string;
};

type ErrorResponse = {
    error: string;
};

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse<SuccessResponse | ErrorResponse>
) {
    try {
        if (!process.env.OPENAI_API_KEY) {
            throw new Error("Missing OPENAI_API_KEY");
        }

        if (req.method !== "POST") {
            return res.status(405).json({ error: "Method not allowed. Use POST." });
        }

        const {
            base_prompt, custom_prompt, image_style, company_id,
            // Composite-specific fields
            composite_product_image_url,
            composite_bg_image_url,
            composite_bg_prompt: compositeOverrideBgPrompt,
            article_title,
            article_excerpt,
        } = req.body ?? {};

        if (!base_prompt || typeof base_prompt !== "string") {
            return res.status(400).json({ error: "base_prompt is required" });
        }

        if (typeof company_id !== "string" || !company_id) {
            return res.status(400).json({ error: "company_id is required" });
        }

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

        const categories = getImageStyleCategories(brand);

        const styleId =
            typeof image_style === "string" &&
                categories.some((c) => c.id === image_style)
                ? image_style
                : "default";

        const resolvedStyle = categories.find((c) => c.id === styleId);
        const isCompositeStyle = resolvedStyle?.type === "composite";
        const hasCompositeProduct = composite_product_image_url && typeof composite_product_image_url === "string";

        if (isCompositeStyle && hasCompositeProduct) {
            // ── Composite pipeline ─────────────────────────────────────
            console.log(`[regenerate] Using composite pipeline for style "${styleId}"`);
            const photo = brand.photography_style;
            let brandDirective = resolvedStyle?.image_prompt_style
                ? `Visual style: ${resolvedStyle.image_prompt_style}\n`
                : "";
            brandDirective += [
                `Lighting: ${photo.lighting}`,
                `Mood: ${photo.mood}`,
                `Feel: ${photo.global_feel.join(", ")}`,
            ].join(". ") + ".";

            const bgPrompt = (typeof compositeOverrideBgPrompt === "string" && compositeOverrideBgPrompt.trim())
                ? compositeOverrideBgPrompt.trim()
                : resolvedStyle?.composite_bg_prompt || undefined;
            const bgImageUrl = (typeof composite_bg_image_url === "string" && composite_bg_image_url.trim())
                ? composite_bg_image_url.trim()
                : resolvedStyle?.composite_bg_image_url || undefined;

            const compositeResult = await generateCompositeImage({
                productImageUrl: composite_product_image_url,
                backgroundImageUrl: bgImageUrl,
                backgroundPrompt: bgPrompt,
                articleTitle: article_title || "Product",
                articleExcerpt: article_excerpt,
                brandStyleDirective: brandDirective,
            });

            return res.status(200).json({
                image_base64: compositeResult.image_base64,
                final_prompt: `Composite: ${compositeResult.background_prompt}`,
                base_prompt,
            });
        }

        // ── Standard AI image generation ───────────────────────────────

        // Strip any previously-embedded style directives from the incoming base_prompt
        const cleanBasePrompt = base_prompt
            .replace(/^MANDATORY VISUAL STYLE[^\n]*\n?/gm, "")
            .replace(/^Context:[^\n]*\n?/gm, "")
            .replace(/^Visual cues the image MUST convey:[^\n]*\n?/gm, "")
            .replace(/^\nAdditional direction:[^\n]*$/gm, "")
            .replace(/\n{3,}/g, "\n\n")
            .trim();

        const parts: string[] = [];

        if (styleId !== "default") {
            const category = categories.find((c) => c.id === styleId);
            if (category) {
                const styleParts: string[] = [];
                if (category.image_prompt_style) {
                    styleParts.push(`MANDATORY VISUAL STYLE — follow this closely: ${category.image_prompt_style}`);
                }
                if (category.narrative) {
                    styleParts.push(`Context: ${category.narrative}`);
                }
                if (category.storytelling_cues.length) {
                    styleParts.push(`Visual cues the image MUST convey: ${category.storytelling_cues.join("; ")}.`);
                }
                if (styleParts.length) {
                    parts.push(styleParts.join("\n"));
                    parts.push("");
                }
            }
        }

        parts.push(cleanBasePrompt);

        if (typeof custom_prompt === "string" && custom_prompt.trim()) {
            parts.push(`\nAdditional direction: ${custom_prompt.trim()}`);
        }

        const finalPrompt = parts.join("\n");

        const image_base64 = await generateImageBase64(finalPrompt);

        if (!image_base64) {
            throw new Error("Image generation returned no data.");
        }

        return res.status(200).json({
            image_base64,
            final_prompt: finalPrompt,
            base_prompt: cleanBasePrompt,
        });
    } catch (err) {
        console.error("API /api/regenerate-image error:", err);
        const message =
            err instanceof Error ? err.message : "Unknown server error";
        return res.status(500).json({ error: message });
    }
}
