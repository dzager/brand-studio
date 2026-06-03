import type { NextApiRequest, NextApiResponse } from "next";
import { getSupabase } from "@/lib/supabase";
import { requireAuth } from "@/lib/auth";

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    const user = await requireAuth(req, res);
    if (!user) return;

    const supabase = getSupabase();
    const { id } = req.query;

    if (typeof id !== "string") {
        return res.status(400).json({ error: "Invalid feedback id" });
    }

    try {
        if (req.method === "PUT") {
            const { body } = req.body;

            if (typeof body !== "string" || !body) {
                return res.status(400).json({ error: "body is required" });
            }

            const { data, error } = await supabase
                .from("company_feedback")
                .update({ body })
                .eq("id", id)
                .select()
                .single();

            if (error) throw error;
            return res.status(200).json(data);
        }

        if (req.method === "DELETE") {
            const { error } = await supabase
                .from("company_feedback")
                .delete()
                .eq("id", id);

            if (error) throw error;
            return res.status(200).json({ success: true });
        }

        return res.status(405).json({ error: "Method not allowed" });
    } catch (err) {
        console.error(`API /api/feedback/${id} error:`, err);
        const message = err instanceof Error ? err.message : "Unknown server error";
        return res.status(500).json({ error: message });
    }
}
