import type { NextApiRequest, NextApiResponse } from "next";
import { getSupabase } from "@/lib/supabase";
import { requireAuth } from "@/lib/auth";

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    const user = await requireAuth(req, res);
    if (!user) return;

    if (req.method !== "POST") {
        return res.status(405).json({ error: "Method not allowed" });
    }

    const supabase = getSupabase();

    try {
        const { id, active } = req.body;

        if (!id || typeof active !== "boolean") {
            return res.status(400).json({ error: "id and active (boolean) are required" });
        }

        const { data, error } = await supabase
            .from("company_feedback")
            .update({ applied_to_model: active })
            .eq("id", id)
            .select()
            .single();

        if (error) throw error;
        return res.status(200).json(data);
    } catch (err) {
        console.error("API /api/feedback/apply-to-model error:", err);
        const message = err instanceof Error ? err.message : "Unknown server error";
        return res.status(500).json({ error: message });
    }
}
