import type { NextApiRequest, NextApiResponse } from "next";
import { getSupabase } from "@/lib/supabase";

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    const supabase = getSupabase();

    try {
        if (req.method === "GET") {
            const { company_id } = req.query;

            let query = supabase
                .from("company_prompts")
                .select("*")
                .order("created_at", { ascending: false });

            if (typeof company_id === "string" && company_id) {
                query = query.eq("company_id", company_id);
            }

            const { data, error } = await query;
            if (error) throw error;
            return res.status(200).json(data);
        }

        if (req.method === "POST") {
            const { company_id, name, body } = req.body;

            if (!company_id || !name || !body) {
                return res.status(400).json({ error: "company_id, name, and body are required" });
            }

            const { data, error } = await supabase
                .from("company_prompts")
                .insert({ company_id, name, body })
                .select()
                .single();

            if (error) throw error;
            return res.status(201).json(data);
        }

        return res.status(405).json({ error: "Method not allowed" });
    } catch (err) {
        console.error("API /api/prompts error:", err);
        const message = err instanceof Error ? err.message : "Unknown server error";
        return res.status(500).json({ error: message });
    }
}
