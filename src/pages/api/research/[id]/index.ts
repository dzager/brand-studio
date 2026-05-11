/**
 * GET    /api/research/[id] — Fetch a research project with sources
 * PUT    /api/research/[id] — Update project (title, etc.)
 * DELETE /api/research/[id] — Delete project and sources
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { getSupabase } from "@/lib/supabase";
import { requireAuth } from "@/lib/auth";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    const authUser = await requireAuth(req, res);
    if (!authUser) return;

    const { id } = req.query;
    if (!id || typeof id !== "string") {
        return res.status(400).json({ error: "Project ID is required" });
    }

    const sb = getSupabase();

    if (req.method === "GET") {
        // Fetch project + sources
        const { data: project, error: projErr } = await sb
            .from("research_projects")
            .select("*")
            .eq("id", id)
            .single();

        if (projErr || !project) {
            return res.status(404).json({ error: "Project not found" });
        }

        const { data: sources } = await sb
            .from("research_sources")
            .select("*")
            .eq("project_id", id)
            .order("relevance_score", { ascending: false });

        return res.status(200).json({ ...project, sources: sources ?? [] });
    }

    if (req.method === "PUT") {
        const { title } = req.body ?? {};
        const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
        if (typeof title === "string" && title.trim()) {
            updates.title = title.trim();
        }

        const { data, error } = await sb
            .from("research_projects")
            .update(updates)
            .eq("id", id)
            .select("*")
            .single();

        if (error) return res.status(500).json({ error: error.message });
        return res.status(200).json(data);
    }

    if (req.method === "DELETE") {
        // Sources cascade-delete via FK
        const { error } = await sb
            .from("research_projects")
            .delete()
            .eq("id", id);

        if (error) return res.status(500).json({ error: error.message });
        return res.status(200).json({ deleted: true });
    }

    return res.status(405).json({ error: "Method not allowed" });
}
