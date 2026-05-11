/**
 * POST /api/research/[id]/brief — Compile a Research Brief from highlights
 *
 * Collects all highlights across sources, uses AI to synthesize into a structured brief.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { getSupabase } from "@/lib/supabase";
import { requireAuth } from "@/lib/auth";
import { compileBrief, type Highlight } from "@/lib/researchAgent";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    const authUser = await requireAuth(req, res);
    if (!authUser) return;

    if (req.method !== "POST") {
        return res.status(405).json({ error: "Method not allowed" });
    }

    const { id } = req.query;
    if (!id || typeof id !== "string") {
        return res.status(400).json({ error: "Project ID is required" });
    }

    const sb = getSupabase();

    // Fetch project
    const { data: project, error: projErr } = await sb
        .from("research_projects")
        .select("id, query, analysis")
        .eq("id", id)
        .single();

    if (projErr || !project) {
        return res.status(404).json({ error: "Project not found" });
    }

    // Fetch all sources with highlights
    const { data: sources } = await sb
        .from("research_sources")
        .select("id, url, title, highlights")
        .eq("project_id", id);

    // Collect all highlights
    const allHighlights: Highlight[] = [];
    for (const source of sources ?? []) {
        const sourceHighlights = source.highlights as any[] ?? [];
        for (const h of sourceHighlights) {
            allHighlights.push({
                text: h.text,
                note: h.note,
                color: h.color,
                source_url: source.url,
                source_title: source.title,
            });
        }
    }

    // If no highlights exist, use the analysis key findings as fallback
    if (allHighlights.length === 0 && project.analysis) {
        const analysis = project.analysis as any;
        if (analysis.key_findings) {
            for (const finding of analysis.key_findings) {
                allHighlights.push({ text: finding });
            }
        }
        if (analysis.statistics) {
            for (const stat of analysis.statistics) {
                allHighlights.push({
                    text: stat.stat,
                    note: stat.context,
                    source_url: stat.source,
                });
            }
        }
    }

    if (allHighlights.length === 0) {
        return res.status(400).json({
            error: "No highlights found. Highlight content from sources first, or the project needs analysis data.",
        });
    }

    try {
        const brief = await compileBrief(project.query, allHighlights);

        // Save brief to project
        await sb
            .from("research_projects")
            .update({
                brief,
                updated_at: new Date().toISOString(),
            })
            .eq("id", id);

        return res.status(200).json(brief);
    } catch (err: any) {
        console.error("[research/brief] Compilation failed:", err);
        return res.status(500).json({ error: err.message || "Brief compilation failed" });
    }
}

export const config = {
    maxDuration: 60,
};
