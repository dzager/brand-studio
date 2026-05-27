import type { NextApiRequest, NextApiResponse } from "next";
import { getAdminSupabase } from "@/lib/supabase";
import { requireAuth } from "@/lib/auth";

export const config = {
    api: {
        bodyParser: {
            sizeLimit: "4mb",
        },
    },
};

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    const user = await requireAuth(req, res);
    if (!user) return;

    // Use admin client (service role) to bypass RLS — auth is already verified above.
    // This matches the GET /api/account/company endpoint pattern and avoids
    // silent failures when the user's session cookies are stale.
    const supabase = getAdminSupabase();
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
                "color_primary", "color_secondary", "brand_colors", "avoid_phrases",
                "image_style_categories", "voice_profile", "editorial_guidelines",
                "seo_content_guidelines", "reference_articles", "evals", "auto_humanize",
                "include_toc", "archived", "preferred_model", "quality_rules",
            ];
            const updates: Record<string, unknown> = {};
            for (const key of allowed) {
                if (req.body[key] !== undefined) {
                    updates[key] = req.body[key];
                }
            }

            const payloadSize = JSON.stringify(updates).length;
            console.log(`[companies/${id}/PUT] Keys: ${Object.keys(updates).join(", ")} | Payload size: ${payloadSize} bytes`);

            const { data, error } = await supabase
                .from("companies")
                .update(updates)
                .eq("id", id)
                .select()
                .single();

            if (error) {
                console.error(`[companies/${id}/PUT] Supabase error:`, JSON.stringify(error, null, 2));
                return res.status(500).json({ error: error.message || error.details || "Database update failed", code: error.code, hint: error.hint });
            }
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
    } catch (err: any) {
        console.error(`API /api/companies/${id} error:`, err);
        const message = err?.message || (typeof err === "object" ? JSON.stringify(err) : String(err)) || "Unknown server error";
        return res.status(500).json({ error: message });
    }
}
