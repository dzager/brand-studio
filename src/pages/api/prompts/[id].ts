import type { NextApiRequest, NextApiResponse } from "next";
import { getSupabase } from "@/lib/supabase";

export const config = {
    api: {
        bodyParser: {
            sizeLimit: "1mb",
        },
    },
};

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    const supabase = getSupabase();
    const { id } = req.query;

    if (typeof id !== "string") {
        return res.status(400).json({ error: "Invalid prompt id" });
    }

    try {
        if (req.method === "PUT") {
            const { name, body } = req.body;

            const updates: Record<string, unknown> = {};
            if (typeof name === "string") updates.name = name;
            if (typeof body === "string") updates.body = body;

            if (Object.keys(updates).length === 0) {
                return res.status(400).json({ error: "No fields to update" });
            }

            const { data, error } = await supabase
                .from("company_prompts")
                .update(updates)
                .eq("id", id)
                .select()
                .single();

            if (error) throw error;
            return res.status(200).json(data);
        }

        if (req.method === "DELETE") {
            const { error } = await supabase
                .from("company_prompts")
                .delete()
                .eq("id", id);

            if (error) throw error;
            return res.status(200).json({ success: true });
        }

        return res.status(405).json({ error: "Method not allowed" });
    } catch (err) {
        console.error(`API /api/prompts/${id} error:`, err);
        const message = err instanceof Error ? err.message : "Unknown server error";
        return res.status(500).json({ error: message });
    }
}
