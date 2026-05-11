/**
 * GET  /api/research        — List research projects
 * POST /api/research        — Create + execute a research project
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { getSupabase } from "@/lib/supabase";
import { requireAuth, getUserAccounts } from "@/lib/auth";
import { conductResearch } from "@/lib/researchAgent";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    const authUser = await requireAuth(req, res);
    if (!authUser) return;

    const accounts = await getUserAccounts(authUser.id);
    const accountIds = accounts.map((a) => a.account_id);

    if (req.method === "GET") {
        return handleList(req, res, accountIds);
    }
    if (req.method === "POST") {
        return handleCreate(req, res, authUser.id, accounts);
    }
    return res.status(405).json({ error: "Method not allowed" });
}

// ── List ─────────────────────────────────────────────────────────────────

async function handleList(
    req: NextApiRequest,
    res: NextApiResponse,
    accountIds: string[]
) {
    const { company_id } = req.query;
    const sb = getSupabase();

    let query = sb
        .from("research_projects")
        .select("id, title, status, query, company_id, account_id, parent_id, created_at, updated_at")
        .in("account_id", accountIds)
        .order("created_at", { ascending: false });

    if (typeof company_id === "string" && company_id) {
        query = query.eq("company_id", company_id);
    }

    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });

    // Attach source count per project
    const projectIds = (data ?? []).map((p: any) => p.id);
    let sourceCounts: Record<string, number> = {};
    if (projectIds.length > 0) {
        const { data: counts } = await sb
            .rpc("research_source_counts", { project_ids: projectIds })
            .select("*");

        // Fallback: manual count if RPC doesn't exist
        if (!counts) {
            const { data: sources } = await sb
                .from("research_sources")
                .select("project_id")
                .in("project_id", projectIds);
            if (sources) {
                for (const s of sources) {
                    sourceCounts[s.project_id] = (sourceCounts[s.project_id] || 0) + 1;
                }
            }
        } else {
            for (const c of counts) {
                sourceCounts[c.project_id] = c.count;
            }
        }
    }

    const enriched = (data ?? []).map((p: any) => ({
        ...p,
        source_count: sourceCounts[p.id] || 0,
    }));

    return res.status(200).json(enriched);
}

// ── Create + Execute ─────────────────────────────────────────────────────

async function handleCreate(
    req: NextApiRequest,
    res: NextApiResponse,
    userId: string,
    accounts: { account_id: string; role: string; company_id?: string | null }[]
) {
    const { query, company_id, model } = req.body ?? {};

    if (!query || typeof query !== "string" || query.trim().length < 3) {
        return res.status(400).json({ error: "query is required (min 3 chars)" });
    }

    if (!company_id || typeof company_id !== "string") {
        return res.status(400).json({ error: "company_id is required" });
    }

    const sb = getSupabase();

    // Determine account_id from company
    const { data: companyData } = await sb
        .from("companies")
        .select("account_id, name, target_audiences")
        .eq("id", company_id)
        .single();

    const accountId = companyData?.account_id || accounts[0]?.account_id;
    if (!accountId) {
        return res.status(400).json({ error: "Could not determine account" });
    }

    // Create the project record
    const { data: project, error: insertErr } = await sb
        .from("research_projects")
        .insert({
            company_id,
            account_id: accountId,
            title: query.trim(),
            status: "researching",
            query: query.trim(),
        })
        .select("id")
        .single();

    if (insertErr || !project) {
        return res.status(500).json({ error: insertErr?.message || "Failed to create project" });
    }

    try {
        // Execute research pipeline
        const result = await conductResearch({
            query: query.trim(),
            companyName: companyData?.name,
            companyIndustry: companyData?.target_audiences,
            model,
        });

        // Save sources
        const sourceRows = result.sources.map((s) => {
            const sourceSummary = result.analysis.source_summaries.find(
                (ss) => ss.url === s.url
            );
            return {
                project_id: project.id,
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

        // Update project with analysis
        await sb
            .from("research_projects")
            .update({
                title: result.title,
                status: "complete",
                analysis: result.analysis,
                suggested_queries: result.analysis.suggested_queries,
                updated_at: new Date().toISOString(),
            })
            .eq("id", project.id);

        return res.status(200).json({
            id: project.id,
            title: result.title,
            status: "complete",
            analysis: result.analysis,
            source_count: result.sources.length,
        });
    } catch (err: any) {
        console.error("[research] Pipeline failed:", err);

        // Mark project as failed
        await sb
            .from("research_projects")
            .update({ status: "failed", updated_at: new Date().toISOString() })
            .eq("id", project.id);

        return res.status(500).json({ error: err.message || "Research pipeline failed" });
    }
}

// Increase timeout for research (can take 30-60s with crawling)
export const config = {
    api: { bodyParser: { sizeLimit: "2mb" } },
    maxDuration: 120,
};
