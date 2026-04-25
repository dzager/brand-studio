import type { NextApiRequest, NextApiResponse } from "next";
import { createServerSupabase } from "@/lib/supabase";
import { requireAuth } from "@/lib/auth";

export const config = {
    api: {
        bodyParser: {
            sizeLimit: "10mb",
        },
    },
};

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    const user = await requireAuth(req, res);
    if (!user) return;

    const supabase = createServerSupabase(req, res);
    const { id } = req.query;

    if (typeof id !== "string") {
        return res.status(400).json({ error: "Invalid article id" });
    }

    try {
        if (req.method === "GET") {
            const { data, error } = await supabase
                .from("articles")
                .select("*")
                .eq("id", id)
                .single();

            if (error) throw error;
            if (!data) return res.status(404).json({ error: "Article not found" });
            return res.status(200).json(data);
        }

        if (req.method === "PUT") {
            const { title, excerpt, html, image_base64, image_prompt } = req.body;

            const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
            if (typeof title === "string") updates.title = title;
            if (typeof excerpt === "string") updates.excerpt = excerpt;
            if (typeof html === "string") updates.html = html;
            if (typeof image_base64 === "string") updates.image_base64 = image_base64;
            if (typeof image_prompt === "string") updates.image_prompt = image_prompt;

            const { data, error } = await supabase
                .from("articles")
                .update(updates)
                .eq("id", id)
                .select()
                .single();

            if (error) throw error;
            return res.status(200).json(data);
        }

        if (req.method === "DELETE") {
            const { error } = await supabase
                .from("articles")
                .delete()
                .eq("id", id);

            if (error) throw error;
            return res.status(200).json({ success: true });
        }

        return res.status(405).json({ error: "Method not allowed" });
    } catch (err) {
        console.error(`API /api/articles/${id} error:`, err);
        const message = err instanceof Error ? err.message : "Unknown server error";
        return res.status(500).json({ error: message });
    }
}
