import type { NextApiRequest, NextApiResponse } from "next";
import { getSupabase } from "@/lib/supabase";

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    const supabase = getSupabase();

    try {
        if (req.method === "GET") {
            const { id: qId, full } = req.query;

            // If requesting a specific article with full content
            if (typeof qId === "string" && qId) {
                const { data, error } = await supabase
                    .from("articles")
                    .select("*")
                    .eq("id", qId)
                    .single();
                if (error) throw error;
                return res.status(200).json(data);
            }

            // List mode: exclude heavy columns (image_base64, html) to avoid Supabase timeout.
            // Note: cluster_id/cluster_role/humanized may not exist if migration hasn't run — Supabase ignores unknown columns in select().
            const { data, error } = await supabase
                .from("articles")
                .select("id,title,slug,excerpt,image_prompt,seo,outline,model_used,image_style,company_id,cluster_id,cluster_role,humanized,created_at,updated_at")
                .order("created_at", { ascending: false });

            if (error) throw error;
            return res.status(200).json(data);
        }

        if (req.method === "POST") {
            const {
                title,
                slug,
                excerpt,
                html,
                image_base64,
                image_prompt,
                seo,
                outline,
                model_used,
                image_style,
            } = req.body;

            const { data, error } = await supabase
                .from("articles")
                .insert({
                    title,
                    slug,
                    excerpt,
                    html,
                    image_base64,
                    image_prompt,
                    seo,
                    outline,
                    model_used,
                    image_style,
                })
                .select()
                .single();

            if (error) throw error;
            return res.status(201).json(data);
        }

        return res.status(405).json({ error: "Method not allowed" });
    } catch (err: any) {
        console.error("API /api/articles error:", err);
        const message = err?.message || (typeof err === "string" ? err : JSON.stringify(err));
        return res.status(500).json({ error: message });
    }
}
