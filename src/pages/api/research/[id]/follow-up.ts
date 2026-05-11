/**
 * POST /api/research/[id]/follow-up — Execute a follow-up research query
 *
 * Creates a new child research project linked to the parent.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { getSupabase } from "@/lib/supabase";
import { requireAuth, getUserAccounts } from "@/lib/auth";
import { conductResearch } from "@/lib/researchAgent";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    const authUser = await requireAuth(req, res);
    if (!authUser) return;

    if (req.method !== "POST") {
        return res.status(405).json({ error: "Method not allowed" });
    }

    const { id } = req.query;
    const { query, model } = req.body ?? {};

    if (!id || typeof id !== "string") {
        return res.status(400).json({ error: "Parent project ID is required" });
    }
    if (!query || typeof query !== "string" || query.trim().length < 3) {
        return res.status(400).json({ error: "query is required (min 3 chars)" });
    }

    const sb = getSupabase();

    // Fetch parent project for company context
    const { data: parent, error: parentErr } = await sb
        .from("research_projects")
        .select("id, company_id, account_id")
        .eq("id", id)
        .single();

    if (parentErr || !parent) {
        return res.status(404).json({ error: "Parent project not found" });
    }

    // Get company name for search context
    let companyName: string | undefined;
    let companyIndustry: string | undefined;
    if (parent.company_id) {
        const { data: company } = await sb
            .from("companies")
            .select("name, target_audiences")
            .eq("id", parent.company_id)
            .single();
        companyName = company?.name;
        companyIndustry = company?.target_audiences;
    }

    // Create child project
    const { data: childProject, error: insertErr } = await sb
        .from("research_projects")
        .insert({
            company_id: parent.company_id,
            account_id: parent.account_id,
            title: query.trim(),
            status: "researching",
            query: query.trim(),
            parent_id: id,
        })
        .select("id")
        .single();

    if (insertErr || !childProject) {
        return res.status(500).json({ error: insertErr?.message || "Failed to create follow-up project" });
    }

    try {
        const result = await conductResearch({
            query: query.trim(),
            companyName,
            companyIndustry,
            model,
        });

        // Save sources
        const sourceRows = result.sources.map((s) => {
            const sourceSummary = result.analysis.source_summaries.find(
                (ss) => ss.url === s.url
            );
            return {
                project_id: childProject.id,
                url: s.url,
                title: s.title,
                domain: s.domain,
                content_text: s.content_text || null,
                summary: sourceSummary?.summary || null,
                relevance_score: sourceSummary?.relevance_score || 0,
            };
        });

        if (sourceRows.length > 0) {
            await sb.from("research_sources").insert(sourceRows);
        }

        // Update project
        await sb
            .from("research_projects")
            .update({
                title: result.title,
                status: "complete",
                analysis: result.analysis,
                suggested_queries: result.analysis.suggested_queries,
                updated_at: new Date().toISOString(),
            })
            .eq("id", childProject.id);

        return res.status(200).json({
            id: childProject.id,
            title: result.title,
            status: "complete",
            analysis: result.analysis,
            source_count: result.sources.length,
        });
    } catch (err: any) {
        console.error("[research/follow-up] Pipeline failed:", err);
        await sb
            .from("research_projects")
            .update({ status: "failed", updated_at: new Date().toISOString() })
            .eq("id", childProject.id);

        return res.status(500).json({ error: err.message || "Follow-up research failed" });
    }
}

export const config = {
    maxDuration: 120,
};
