import type { NextApiRequest, NextApiResponse } from "next";
import { getImageStyleCategories } from "@/brand/engine";
import { getSupabase } from "@/lib/supabase";
import { buildBrandEngine, type CompanyRecord } from "@/lib/buildBrandEngine";
import { generateImageBase64 } from "@/lib/ai-client";

type SuccessResponse = {
    image_base64: string;
    final_prompt: string;
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

        const { base_prompt, custom_prompt, image_style, company_id } = req.body ?? {};

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

        // Build the final prompt: style (dominant) + base + optional custom augmentation
        const styleId =
            typeof image_style === "string" &&
                categories.some((c) => c.id === image_style)
                ? image_style
                : "default";

        const parts: string[] = [];

        // Prepend the style as the dominant directive so it carries more weight
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
                    parts.push(""); // blank line separator
                }
            }
        }

        parts.push(base_prompt.trim());

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
        });
    } catch (err) {
        console.error("API /api/regenerate-image error:", err);
        const message =
            err instanceof Error ? err.message : "Unknown server error";
        return res.status(500).json({ error: message });
    }
}
