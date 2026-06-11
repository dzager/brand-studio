/**
 * Link Audit API
 *
 * POST /api/link-audit — Start a new link audit
 * GET  /api/link-audit — List audits for the current account
 * PATCH /api/link-audit — Cancel a running audit
 */

import type { NextApiRequest, NextApiResponse } from "next";
import { getSupabase } from "@/lib/supabase";
import { requireAuth, getUserAccounts } from "@/lib/auth";
import { deepCrawl, crawlSinglePage, crawlUrls } from "@/lib/freshnessCrawler";
import { runLinkAudit } from "@/lib/linkAuditEngine";
import { getCachedCrawl, setCrawlCache, cleanExpiredCache } from "@/lib/crawlCache";

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
    if (req.method === "PUT") return handleContinue(req, res, accountIds);
    if (req.method === "PATCH") return handleCancel(req, res, accountIds);
    return res.status(405).json({ error: "Method not allowed" });
}

async function handleList(res: NextApiResponse, accountIds: string[]) {
    const sb = getSupabase();
    const { data, error } = await sb
        .from("link_audits")
        .select("id, site_url, status, company_id, pages_crawled, total_links, broken_links, redirects_found, orphan_pages, opportunities_found, overall_score, created_at, completed_at, error")
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
        .from("link_audits")
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

    // Respond immediately
    res.status(200).json({ id: auditId, status: "running" });

    // Fire-and-forget: run the audit pipeline in the background
    runAuditPipeline(sb, auditId, accountId, url.trim(), max_pages, !!single_page).catch((err) => {
        console.error(`[link-audit] Background pipeline error for ${auditId}:`, err);
    });

    // Lazy cleanup of expired cache entries
    cleanExpiredCache().catch(() => {});
}

async function handleCancel(
    req: NextApiRequest,
    res: NextApiResponse,
    accountIds: string[]
) {
    const { id } = req.body ?? {};
    if (!id || typeof id !== "string") {
        return res.status(400).json({ error: "Audit ID is required." });
    }

    const sb = getSupabase();

    const { data: audit } = await sb
        .from("link_audits")
        .select("id, status, account_id")
        .eq("id", id)
        .single();

    if (!audit || !accountIds.includes(audit.account_id)) {
        return res.status(404).json({ error: "Audit not found." });
    }

    if (audit.status !== "running") {
        return res.status(400).json({ error: "Audit is not running." });
    }

    const { error } = await sb
        .from("link_audits")
        .update({ status: "cancelled", error: "Stopped by user", completed_at: new Date().toISOString() })
        .eq("id", id);

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ id, status: "cancelled" });
}

/**
 * Runs the full crawl → link-check → analyze pipeline.
 */
async function runAuditPipeline(
    sb: ReturnType<typeof getSupabase>,
    auditId: string,
    accountId: string,
    siteUrl: string,
    maxPages: number | undefined,
    singlePage: boolean
) {
    async function isCancelled(): Promise<boolean> {
        const { data } = await sb
            .from("link_audits")
            .select("status")
            .eq("id", auditId)
            .single();
        return data?.status !== "running";
    }

    try {
        // Step 1: Crawl (with cache)
        const scope = singlePage ? siteUrl : "deep";
        let crawlResult = await getCachedCrawl(accountId, siteUrl, scope);

        if (!crawlResult) {
            crawlResult = singlePage
                ? await crawlSinglePage(siteUrl)
                : await deepCrawl(siteUrl, { maxPages: maxPages ?? 50 });

            // Cache the result for other audit types to reuse
            if (crawlResult.pages_crawled > 0) {
                await setCrawlCache(accountId, siteUrl, scope, crawlResult);
            }
        } else {
            console.log(`[link-audit] Using cached crawl for ${siteUrl}`);
        }

        if (crawlResult.pages_crawled === 0) {
            throw new Error("No pages could be crawled. The website may be blocking automated requests.");
        }

        if (await isCancelled()) return;

        await sb.from("link_audits")
            .update({ pages_crawled: crawlResult.pages_crawled })
            .eq("id", auditId)
            .eq("status", "running");

        // Step 2: Run link audit engine
        const report = await runLinkAudit(crawlResult, {
            checkExternal: true,
            maxLinksToCheck: 500,
            onPartialReport: async (partial) => {
                await sb.from("link_audits")
                    .update({
                        pages_crawled: partial.pages_crawled ?? crawlResult.pages_crawled,
                        total_links: partial.total_links ?? 0,
                        broken_links: partial.broken_links?.length ?? 0,
                        redirects_found: partial.redirect_links?.length ?? 0,
                    })
                    .eq("id", auditId)
                    .eq("status", "running");
            },
        });

        // Strip the large all_links array from the stored report to save DB space
        // but keep remaining_urls so the UI can prompt to continue
        const reportForStorage = {
            ...report,
            all_links: undefined,
            remaining_urls: crawlResult.remaining_urls ?? [],
            pages_discovered: crawlResult.pages_discovered ?? crawlResult.pages_crawled,
        };

        await sb.from("link_audits")
            .update({
                status: "complete",
                pages_crawled: report.pages_crawled,
                total_links: report.total_links,
                broken_links: report.broken_links.length,
                redirects_found: report.redirect_links.length,
                orphan_pages: report.orphan_pages.length,
                opportunities_found: report.opportunities.length,
                overall_score: report.overall_score,
                report: reportForStorage,
                completed_at: new Date().toISOString(),
            })
            .eq("id", auditId)
            .eq("status", "running");
    } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        await sb.from("link_audits")
            .update({ status: "failed", error: message, completed_at: new Date().toISOString() })
            .eq("id", auditId)
            .eq("status", "running");
    }
}

/* ── Continue (PUT) ─────────────────────────────────────── */

async function handleContinue(
    req: NextApiRequest,
    res: NextApiResponse,
    accountIds: string[]
) {
    const { id } = req.body ?? {};
    if (!id || typeof id !== "string") {
        return res.status(400).json({ error: "Audit ID is required." });
    }

    const sb = getSupabase();

    const { data: audit } = await sb
        .from("link_audits")
        .select("id, status, account_id, site_url, report, pages_crawled")
        .eq("id", id)
        .single();

    if (!audit || !accountIds.includes(audit.account_id)) {
        return res.status(404).json({ error: "Audit not found." });
    }

    if (audit.status !== "complete") {
        return res.status(400).json({ error: "Audit must be complete before continuing." });
    }

    const existingReport = audit.report as any;
    const remainingUrls: string[] = existingReport?.remaining_urls ?? [];

    if (remainingUrls.length === 0) {
        return res.status(400).json({ error: "No remaining pages to scan." });
    }

    // Set status back to running
    await sb.from("link_audits")
        .update({ status: "running", completed_at: null })
        .eq("id", id);

    res.status(200).json({ id, status: "running" });

    // Fire-and-forget: continue pipeline
    continuePipeline(sb, id, audit.site_url, existingReport, remainingUrls).catch((err) => {
        console.error(`[link-audit] Continue pipeline error for ${id}:`, err);
    });
}

/**
 * Continue an existing link audit — crawl remaining URLs and merge into the report.
 */
async function continuePipeline(
    sb: ReturnType<typeof getSupabase>,
    auditId: string,
    siteUrl: string,
    existingReport: any,
    remainingUrls: string[]
) {
    try {
        // Crawl the next batch from remaining URLs
        const crawlResult = await crawlUrls(siteUrl, remainingUrls, { maxPages: 50 });

        if (crawlResult.pages_crawled === 0) {
            // No new pages could be fetched — mark complete with existing data
            await sb.from("link_audits")
                .update({
                    status: "complete",
                    report: { ...existingReport, remaining_urls: crawlResult.remaining_urls },
                    completed_at: new Date().toISOString(),
                })
                .eq("id", auditId)
                .eq("status", "running");
            return;
        }

        // Run link audit on the new pages
        const newReport = await runLinkAudit(crawlResult, {
            checkExternal: true,
            maxLinksToCheck: 500,
            onPartialReport: async (partial) => {
                await sb.from("link_audits")
                    .update({
                        pages_crawled: (existingReport.pages_crawled ?? 0) + (partial.pages_crawled ?? 0),
                        total_links: (existingReport.total_links ?? 0) + (partial.total_links ?? 0),
                    })
                    .eq("id", auditId)
                    .eq("status", "running");
            },
        });

        // Merge new report into existing report
        const mergedBroken = [...(existingReport.broken_links ?? []), ...newReport.broken_links];
        const mergedRedirects = [...(existingReport.redirect_links ?? []), ...newReport.redirect_links];
        const mergedOrphans = [...(existingReport.orphan_pages ?? []), ...newReport.orphan_pages];
        const mergedOpportunities = [...(existingReport.opportunities ?? []), ...newReport.opportunities];
        const mergedDensity = [...(existingReport.link_density ?? []), ...(newReport.link_density ?? [])];
        const totalPagesCrawled = (existingReport.pages_crawled ?? 0) + newReport.pages_crawled;
        const totalLinks = (existingReport.total_links ?? 0) + newReport.total_links;
        const totalPagesDiscovered = existingReport.pages_discovered ?? totalPagesCrawled;

        // Deduplicate broken links by URL
        const seenBroken = new Set<string>();
        const dedupBroken = mergedBroken.filter((l: any) => {
            const key = `${l.url}|${l.source_url}`;
            if (seenBroken.has(key)) return false;
            seenBroken.add(key);
            return true;
        });

        // Recalculate overall score
        const brokenCount = dedupBroken.length;
        const overallScore = totalLinks > 0
            ? Math.max(0, Math.round(100 - (brokenCount / totalLinks) * 100))
            : 100;

        const mergedReport = {
            ...existingReport,
            pages_crawled: totalPagesCrawled,
            total_links: totalLinks,
            broken_links: dedupBroken,
            redirect_links: mergedRedirects,
            orphan_pages: mergedOrphans,
            opportunities: mergedOpportunities,
            link_density: mergedDensity,
            overall_score: overallScore,
            remaining_urls: crawlResult.remaining_urls,
            pages_discovered: totalPagesDiscovered,
        };

        await sb.from("link_audits")
            .update({
                status: "complete",
                pages_crawled: totalPagesCrawled,
                total_links: totalLinks,
                broken_links: dedupBroken.length,
                redirects_found: mergedRedirects.length,
                orphan_pages: mergedOrphans.length,
                opportunities_found: mergedOpportunities.length,
                overall_score: overallScore,
                report: mergedReport,
                completed_at: new Date().toISOString(),
            })
            .eq("id", auditId)
            .eq("status", "running");
    } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        await sb.from("link_audits")
            .update({ status: "failed", error: message, completed_at: new Date().toISOString() })
            .eq("id", auditId)
            .eq("status", "running");
    }
}
