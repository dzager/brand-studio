// src/pages/api/clusters/[id]/articles.ts
// POST: Assign articles to cluster  { article_ids: string[], role: "pillar" | "supporting" | "long_tail" }
// DELETE: Remove article from cluster  { article_id: string }
// GET: List articles in this cluster (with unassigned articles for the same company)

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
        // GET: Return articles in this cluster + unassigned articles for the same company
        if (req.method === "GET") {
            // Get the cluster to know the company_id
            const { data: cluster, error: clusterErr } = await supabase
                .from("clusters")
                .select("id, company_id, name")
                .eq("id", id)
                .single();
            if (clusterErr) throw clusterErr;
            if (!cluster) return res.status(404).json({ error: "Cluster not found" });

            // Get articles assigned to this cluster
            const { data: assigned, error: assignedErr } = await supabase
                .from("articles")
                .select("id, title, slug, excerpt, cluster_role, created_at, seo, company_id")
                .eq("cluster_id", id)
                .order("cluster_role", { ascending: true });
            if (assignedErr) throw assignedErr;

            // Get unassigned articles for the same company (cluster_id IS NULL)
            const { data: unassigned, error: unassignedErr } = await supabase
                .from("articles")
                .select("id, title, slug, excerpt, cluster_role, created_at, seo, company_id")
                .eq("company_id", cluster.company_id)
                .is("cluster_id", null)
                .order("created_at", { ascending: false });
            if (unassignedErr) throw unassignedErr;

            return res.status(200).json({
                cluster_id: id,
                company_id: cluster.company_id,
                assigned: assigned ?? [],
                unassigned: unassigned ?? [],
            });
        }

        // POST: Assign articles to this cluster
        if (req.method === "POST") {
            const { article_ids, role } = req.body ?? {};

            if (!Array.isArray(article_ids) || article_ids.length === 0) {
                return res.status(400).json({ error: "article_ids array is required" });
            }

            const validRoles = ["pillar", "supporting", "long_tail"];
            if (!role || !validRoles.includes(role)) {
                return res.status(400).json({ error: `role must be one of: ${validRoles.join(", ")}` });
            }

            // If assigning a pillar, check that cluster doesn't already have one (unless we're replacing)
            if (role === "pillar") {
                const { data: existingPillar } = await supabase
                    .from("articles")
                    .select("id")
                    .eq("cluster_id", id)
                    .eq("cluster_role", "pillar");

                if (existingPillar && existingPillar.length > 0) {
                    // Demote existing pillar to supporting
                    for (const ep of existingPillar) {
                        await supabase
                            .from("articles")
                            .update({ cluster_role: "supporting" })
                            .eq("id", ep.id);
                    }
                }
            }

            // Assign each article
            const results: { id: string; success: boolean; error?: string }[] = [];
            for (const articleId of article_ids) {
                const { error: updateErr } = await supabase
                    .from("articles")
                    .update({
                        cluster_id: id,
                        cluster_role: role,
                    })
                    .eq("id", articleId);

                results.push({
                    id: articleId,
                    success: !updateErr,
                    error: updateErr?.message,
                });
            }

            return res.status(200).json({
                assigned: results.filter((r) => r.success).length,
                failed: results.filter((r) => !r.success).length,
                results,
            });
        }

        // DELETE: Remove an article from this cluster (unassign)
        if (req.method === "DELETE") {
            const { article_id } = req.body ?? {};

            if (!article_id) {
                return res.status(400).json({ error: "article_id is required" });
            }

            const { error: updateErr } = await supabase
                .from("articles")
                .update({
                    cluster_id: null,
                    cluster_role: null,
                })
                .eq("id", article_id)
                .eq("cluster_id", id); // Safety: only remove if actually in this cluster

            if (updateErr) throw updateErr;

            return res.status(200).json({ success: true });
        }

        // PUT: Update an article's role within this cluster
        if (req.method === "PUT") {
            const { article_id, role } = req.body ?? {};

            if (!article_id || !role) {
                return res.status(400).json({ error: "article_id and role are required" });
            }

            const validRoles = ["pillar", "supporting", "long_tail"];
            if (!validRoles.includes(role)) {
                return res.status(400).json({ error: `role must be one of: ${validRoles.join(", ")}` });
            }

            // If changing to pillar, demote existing pillar
            if (role === "pillar") {
                const { data: existingPillar } = await supabase
                    .from("articles")
                    .select("id")
                    .eq("cluster_id", id)
                    .eq("cluster_role", "pillar")
                    .neq("id", article_id);

                if (existingPillar && existingPillar.length > 0) {
                    for (const ep of existingPillar) {
                        await supabase
                            .from("articles")
                            .update({ cluster_role: "supporting" })
                            .eq("id", ep.id);
                    }
                }
            }

            const { error: updateErr } = await supabase
                .from("articles")
                .update({ cluster_role: role })
                .eq("id", article_id)
                .eq("cluster_id", id);

            if (updateErr) throw updateErr;

            return res.status(200).json({ success: true });
        }

        return res.status(405).json({ error: "Method not allowed" });
    } catch (err: any) {
        console.error(`API /api/clusters/${id}/articles error:`, err);
        const message = err?.message || "Unknown server error";
        return res.status(500).json({ error: message });
    }
}
