// src/pages/api/clusters/manual.ts
// POST: Create a manual cluster (just name + company, no LLM strategy)

import type { NextApiRequest, NextApiResponse } from "next";
import { getSupabase } from "@/lib/supabase";

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    if (req.method !== "POST") {
        return res.status(405).json({ error: "Method not allowed. Use POST." });
    }

    const supabase = getSupabase();

    try {
        const { company_id, name, pillar_topic } = req.body ?? {};

        if (!company_id || !name) {
            return res.status(400).json({ error: "company_id and name are required" });
        }

        // Create an empty strategy shell for manual clusters
        const strategy = {
            cluster_name: name.trim(),
            pillar: {
                title: "",
                keyword: "",
                slug: "",
                description: "",
                word_count: "",
                links_to: [],
            },
            supporting: [],
            long_tail: [],
        };

        const { data: cluster, error: saveErr } = await supabase
            .from("clusters")
            .insert({
                company_id,
                name: name.trim(),
                pillar_topic: (pillar_topic || name).trim(),
                strategy,
                status: "draft",
            })
            .select()
            .single();

        if (saveErr) throw saveErr;

        return res.status(201).json(cluster);
    } catch (err: any) {
        console.error("API /api/clusters/manual error:", err);
        const message = err?.message || "Unknown server error";
        return res.status(500).json({ error: message });
    }
}
