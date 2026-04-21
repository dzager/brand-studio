import type { NextApiRequest, NextApiResponse } from "next";
import { getSupabase } from "@/lib/supabase";

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    const supabase = getSupabase();
    const { id } = req.query;

    if (typeof id !== "string") {
        return res.status(400).json({ error: "Invalid company id" });
    }

    try {
        if (req.method === "GET") {
            const { data, error } = await supabase
                .from("companies")
                .select("*")
                .eq("id", id)
                .single();

            if (error) throw error;
            return res.status(200).json(data);
        }

        if (req.method === "PUT") {
            const allowed = [
                "name", "tagline", "mission", "archetype", "tone",
                "target_audiences", "photography_style",
                "color_primary", "color_secondary", "avoid_phrases",
                "image_style_categories", "voice_profile", "editorial_guidelines",
                "seo_content_guidelines", "reference_articles", "evals", "auto_humanize",
                "include_toc", "archived",
            ];
            const updates: Record<string, unknown> = {};
            for (const key of allowed) {
                if (req.body[key] !== undefined) {
                    updates[key] = req.body[key];
                }
            }

            const { data, error } = await supabase
                .from("companies")
                .update(updates)
                .eq("id", id)
                .select()
                .single();

            if (error) throw error;
            return res.status(200).json(data);
        }

        if (req.method === "DELETE") {
            const { error } = await supabase
                .from("companies")
                .delete()
                .eq("id", id);

            if (error) throw error;
            return res.status(200).json({ success: true });
        }

        return res.status(405).json({ error: "Method not allowed" });
    } catch (err) {
        console.error(`API /api/companies/${id} error:`, err);
        const message = err instanceof Error ? err.message : "Unknown server error";
        return res.status(500).json({ error: message });
    }
}
