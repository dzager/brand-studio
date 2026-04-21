import type { NextApiRequest, NextApiResponse } from "next";
import { getSupabase } from "@/lib/supabase";
import { buildBrandEngine, type CompanyRecord } from "@/lib/buildBrandEngine";
import { getImageStyleCategories } from "@/brand/engine";
import { generateCompositeImage, type CompositeImageResult } from "@/lib/compositeEngine";

type SuccessResponse = {
    image_base64: string;
    background_prompt: string;
};

type ErrorResponse = {
    error: string;
};

/**
 * POST /api/composite-image
 *
 * Two-image composite workflow:
 *  1. Product image — fetched from URL or provided as base64, background removed via Gemini
 *  2. Background image — AI-generated, fetched from URL, or provided as base64
 *  3. Product composited centered on top of the background
 */
export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse<SuccessResponse | ErrorResponse>
) {
    try {
        if (req.method !== "POST") {
            return res.status(405).json({ error: "Method not allowed. Use POST." });
        }

        const {
            product_image_url,
            product_image_base64,
            article_title,
            article_excerpt,
            // Background source — exactly one of these three:
            background_image_url,
            background_image_base64,
            custom_bg_prompt,
            // Styling
            image_style,
            company_id,
        } = req.body ?? {};

        // Require either product URL or base64
        const hasProductUrl = product_image_url && typeof product_image_url === "string";
        const hasProductBase64 = product_image_base64 && typeof product_image_base64 === "string";
        if (!hasProductUrl && !hasProductBase64) {
            return res.status(400).json({ error: "product_image_url or product_image_base64 is required" });
        }
        if (!article_title || typeof article_title !== "string") {
            return res.status(400).json({ error: "article_title is required" });
        }

        // ── Build brand engine (optional, for style + photography guidance) ──
        let brandStyleDirective = "";
        if (company_id && typeof company_id === "string") {
            try {
                const { data: companyData } = await getSupabase()
                    .from("companies")
                    .select("*")
                    .eq("id", company_id)
                    .single();

                if (companyData) {
                    const brand = buildBrandEngine(companyData as CompanyRecord);
                    const categories = getImageStyleCategories(brand);
                    const styleId =
                        typeof image_style === "string" &&
                        categories.some((c) => c.id === image_style)
                            ? image_style
                            : "default";

                    if (styleId !== "default") {
                        const category = categories.find((c) => c.id === styleId);
                        if (category?.image_prompt_style) {
                            brandStyleDirective = `Visual style: ${category.image_prompt_style}\n`;
                        }
                    }

                    // Add photography guidance
                    const photo = brand.photography_style;
                    brandStyleDirective += [
                        `Lighting: ${photo.lighting}`,
                        `Mood: ${photo.mood}`,
                        `Feel: ${photo.global_feel.join(", ")}`,
                    ].join(". ") + ".";
                }
            } catch {
                // Non-critical — proceed without brand context
            }
        }

        // Delegate to the reusable composite engine
        const result: CompositeImageResult = await generateCompositeImage({
            productImageUrl: hasProductUrl ? product_image_url : undefined,
            productImageBase64: hasProductBase64 ? product_image_base64 : undefined,
            backgroundImageUrl: background_image_url,
            backgroundImageBase64: background_image_base64,
            backgroundPrompt: custom_bg_prompt,
            articleTitle: article_title,
            articleExcerpt: article_excerpt,
            brandStyleDirective,
        });

        return res.status(200).json(result);
    } catch (err) {
        console.error("API /api/composite-image error:", err);
        const message =
            err instanceof Error ? err.message : "Unknown server error";
        return res.status(500).json({ error: message });
    }
}

export const config = {
    api: {
        responseLimit: "20mb",
        bodyParser: {
            sizeLimit: "10mb",
        },
    },
};
