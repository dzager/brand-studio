// src/pages/api/clusters/[id].ts
// GET: get cluster with its articles
// PUT: update cluster name/strategy
// DELETE: delete cluster (articles keep cluster_id nulled)

import type { NextApiRequest, NextApiResponse } from "next";
import { getSupabase } from "@/lib/supabase";

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    const supabase = getSupabase();
    const { id } = req.query;

    if (typeof id !== "string") {
        return res.status(400).json({ error: "Invalid cluster id" });
    }

    try {
        if (req.method === "GET") {
            // Get cluster
            const { data: cluster, error: clusterErr } = await supabase
                .from("clusters")
                .select("*")
                .eq("id", id)
                .single();

            if (clusterErr) throw clusterErr;
            if (!cluster) return res.status(404).json({ error: "Cluster not found" });

            // Get articles in this cluster
            const { data: articles, error: articlesErr } = await supabase
                .from("articles")
                .select("id, title, slug, excerpt, cluster_role, created_at, seo")
                .eq("cluster_id", id)
                .order("created_at", { ascending: true });

            if (articlesErr) throw articlesErr;

            return res.status(200).json({ ...cluster, articles: articles ?? [] });
        }

        if (req.method === "PUT") {
            const { name, strategy, status } = req.body;

            const updates: Record<string, unknown> = {
                updated_at: new Date().toISOString(),
            };
            if (typeof name === "string") updates.name = name;
            if (strategy && typeof strategy === "object") updates.strategy = strategy;
            if (typeof status === "string") updates.status = status;

            const { data, error } = await supabase
                .from("clusters")
                .update(updates)
                .eq("id", id)
                .select()
                .single();

            if (error) throw error;
            return res.status(200).json(data);
        }

        if (req.method === "DELETE") {
            const { error } = await supabase
                .from("clusters")
                .delete()
                .eq("id", id);

            if (error) throw error;
            return res.status(200).json({ success: true });
        }

        return res.status(405).json({ error: "Method not allowed" });
    } catch (err) {
        console.error(`API /api/clusters/${id} error:`, err);
        const message = err instanceof Error ? err.message : "Unknown server error";
        return res.status(500).json({ error: message });
    }
}
