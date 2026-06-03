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

    try {
        if (req.method === "GET") {
            const { company_id } = req.query;

            if (typeof company_id !== "string" || !company_id) {
                return res.status(400).json({ error: "company_id is required" });
            }

            const { data, error } = await supabase
                .from("company_feedback")
                .select("*")
                .eq("company_id", company_id)
                .order("created_at", { ascending: false });

            if (error) throw error;
            return res.status(200).json(data);
        }

        if (req.method === "POST") {
            const { company_id, body } = req.body;

            if (!company_id || !body) {
                return res.status(400).json({ error: "company_id and body are required" });
            }

            const { data, error } = await supabase
                .from("company_feedback")
                .insert({
                    company_id,
                    body,
                    user_id: user.id,
                    user_email: user.email,
                })
                .select()
                .single();

            if (error) throw error;
            return res.status(201).json(data);
        }

        return res.status(405).json({ error: "Method not allowed" });
    } catch (err) {
        console.error("API /api/feedback error:", err);
        const message = err instanceof Error ? err.message : "Unknown server error";
        return res.status(500).json({ error: message });
    }
}
