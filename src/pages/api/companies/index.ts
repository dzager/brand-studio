import type { NextApiRequest, NextApiResponse } from "next";
import { getSupabase } from "@/lib/supabase";

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    const supabase = getSupabase();

    try {
        if (req.method === "GET") {
            const { data, error } = await supabase
                .from("companies")
                .select("*")
                .order("created_at", { ascending: false });

            if (error) throw error;
            return res.status(200).json(data);
        }

        if (req.method === "POST") {
            const {
                name,
                tagline,
                mission,
                archetype,
                tone,
                target_audiences,
                photography_style,
                color_primary,
                color_secondary,
                avoid_phrases,
                image_style_categories,
                voice_profile,
                editorial_guidelines,
                seo_content_guidelines,
                reference_articles,
                evals,
                auto_humanize,
            } = req.body;

            if (!name || typeof name !== "string" || name.trim().length < 1) {
                return res.status(400).json({ error: "Company name is required" });
            }

            const insertPayload: Record<string, unknown> = {
                name: name.trim(),
                tagline: tagline?.trim() || null,
                mission: mission?.trim() || null,
                archetype: archetype?.trim() || "guide",
                tone: tone?.trim() || "confident, clear, modern",
                target_audiences: target_audiences ?? [],
                photography_style: photography_style?.trim() || null,
                color_primary: color_primary?.trim() || "#000000",
                color_secondary: color_secondary?.trim() || "#FFFFFF",
                avoid_phrases: avoid_phrases?.trim() || null,
            };
            if (image_style_categories !== undefined) {
                insertPayload.image_style_categories = image_style_categories ?? null;
            }
            if (voice_profile !== undefined) {
                insertPayload.voice_profile = voice_profile ?? null;
            }
            if (editorial_guidelines !== undefined) {
                insertPayload.editorial_guidelines = editorial_guidelines?.trim() || null;
            }
            if (seo_content_guidelines !== undefined) {
                insertPayload.seo_content_guidelines = seo_content_guidelines?.trim() || null;
            }
            if (reference_articles !== undefined) {
                insertPayload.reference_articles = reference_articles ?? null;
            }
            if (evals !== undefined) {
                insertPayload.evals = evals ?? null;
            }
            if (auto_humanize !== undefined) {
                insertPayload.auto_humanize = auto_humanize ?? true;
            }

            const { data, error } = await supabase
                .from("companies")
                .insert(insertPayload)
                .select()
                .single();

            if (error) throw error;
            return res.status(201).json(data);
        }

        return res.status(405).json({ error: "Method not allowed" });
    } catch (err) {
        console.error("API /api/companies error:", err);
        const message = err instanceof Error ? err.message : "Unknown server error";
        return res.status(500).json({ error: message });
    }
}
