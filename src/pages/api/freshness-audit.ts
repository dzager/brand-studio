/**
 * Freshness Audit API
 *
 * POST /api/freshness-audit — Start a new freshness audit
 * GET  /api/freshness-audit — List audits for the current account
 */

import type { NextApiRequest, NextApiResponse } from "next";
import { getSupabase } from "@/lib/supabase";
import { requireAuth, getUserAccounts } from "@/lib/auth";
import { deepCrawl, crawlSinglePage } from "@/lib/freshnessCrawler";
import { runAudit } from "@/lib/freshnessEngine";

export const config = {
    api: { responseLimit: false },
    maxDuration: 300,
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    const authUser = await requireAuth(req, res);
    if (!authUser) return;

    const accounts = await getUserAccounts(authUser.id);
    const accountIds = accounts.map(a => a.account_id);

    if (req.method === "GET") return handleList(res, accountIds);
    if (req.method === "POST") return handleCreate(req, res, accounts);
    return res.status(405).json({ error: "Method not allowed" });
}

async function handleList(res: NextApiResponse, accountIds: string[]) {
    const sb = getSupabase();
    const { data, error } = await sb
        .from("freshness_audits")
        .select("id, site_url, status, company_id, pages_crawled, total_facts, issues_found, critical_issues, overall_health, created_at, completed_at, error")
        .in("account_id", accountIds)
        .order("created_at", { ascending: false })
        .limit(50);

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json(data ?? []);
}

async function handleCreate(
    req: NextApiRequest,
    res: NextApiResponse,
    accounts: { account_id: string; role: string; company_id?: string | null }[]
) {
    const { url, company_id, max_pages, single_page } = req.body ?? {};

    if (!url || typeof url !== "string" || url.trim().length < 4) {
        return res.status(400).json({ error: "A valid URL is required." });
    }

    const accountId = accounts[0]?.account_id;
    if (!accountId) return res.status(400).json({ error: "No account found" });

    const sb = getSupabase();

    // Create audit record
    const { data: audit, error: insertError } = await sb
        .from("freshness_audits")
        .insert({
            account_id: accountId,
            company_id: company_id || null,
            site_url: url.trim(),
            status: "running",
        })
        .select("id")
        .single();

    if (insertError) return res.status(500).json({ error: insertError.message });
    const auditId = audit.id;

    // Respond immediately so the client can start additional audits concurrently.
    // The heavy crawl + audit pipeline runs in the background.
    res.status(200).json({ id: auditId, status: "running" });

    // Fire-and-forget: run the audit pipeline in the background
    runAuditPipeline(sb, auditId, url.trim(), company_id, max_pages, !!single_page).catch((err) => {
        console.error(`[freshness-audit] Background pipeline error for ${auditId}:`, err);
    });
}

/**
 * Runs the full crawl → extract → verify → report pipeline.
 * Called fire-and-forget after the HTTP response has been sent.
 */
async function runAuditPipeline(
    sb: ReturnType<typeof getSupabase>,
    auditId: string,
    siteUrl: string,
    companyId: string | undefined,
    maxPages: number | undefined,
    singlePage: boolean
) {
    try {
        const crawlResult = singlePage
            ? await crawlSinglePage(siteUrl)
            : await deepCrawl(siteUrl, { maxPages: maxPages ?? 30 });

        if (crawlResult.pages_crawled === 0) {
            throw new Error("No pages could be crawled. The website may be blocking automated bot requests (e.g., Cloudflare protection or HTTP 403/404).");
        }

        await sb.from("freshness_audits")
            .update({ pages_crawled: crawlResult.pages_crawled })
            .eq("id", auditId);

        const report = await runAudit(
            crawlResult,
            companyId || "",
            undefined, // onProgress
            async (partialReport) => {
                await sb.from("freshness_audits")
                    .update({
                        pages_crawled: partialReport.pages_crawled,
                        total_facts: partialReport.total_facts_extracted,
                        issues_found: partialReport.issues_found,
                        critical_issues: partialReport.critical_issues,
                        overall_health: partialReport.overall_health,
                        report: partialReport
                    })
                    .eq("id", auditId);
            }
        );

        await sb.from("freshness_audits")
            .update({
                status: "complete",
                pages_crawled: report.pages_crawled,
                total_facts: report.total_facts_extracted,
                issues_found: report.issues_found,
                critical_issues: report.critical_issues,
                overall_health: report.overall_health,
                report,
                completed_at: new Date().toISOString(),
            })
            .eq("id", auditId);
    } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        await sb.from("freshness_audits")
            .update({ status: "failed", error: message, completed_at: new Date().toISOString() })
            .eq("id", auditId);
    }
}
