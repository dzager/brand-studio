/**
 * PUT /api/research/[id]/highlights — Update highlights for a source
 *
 * Body: { source_id: string, highlights: Highlight[] }
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { getSupabase } from "@/lib/supabase";
import { requireAuth } from "@/lib/auth";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    const authUser = await requireAuth(req, res);
    if (!authUser) return;

    if (req.method !== "PUT") {
        return res.status(405).json({ error: "Method not allowed" });
    }

    const { id } = req.query;
    const { source_id, highlights } = req.body ?? {};

    if (!id || typeof id !== "string") {
        return res.status(400).json({ error: "Project ID is required" });
    }
    if (!source_id || typeof source_id !== "string") {
        return res.status(400).json({ error: "source_id is required" });
    }
    if (!Array.isArray(highlights)) {
        return res.status(400).json({ error: "highlights must be an array" });
    }

    const sb = getSupabase();

    // Verify the source belongs to this project
    const { data: source, error: sourceErr } = await sb
        .from("research_sources")
        .select("id, project_id")
        .eq("id", source_id)
        .eq("project_id", id)
        .single();

    if (sourceErr || !source) {
        return res.status(404).json({ error: "Source not found in this project" });
    }

    const { data, error } = await sb
        .from("research_sources")
        .update({ highlights })
        .eq("id", source_id)
        .select("id, highlights")
        .single();

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json(data);
}
