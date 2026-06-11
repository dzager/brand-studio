/**
 * Site Audit API — Combo endpoint that runs freshness + link audits with a single crawl
 *
 * POST /api/site-audit — Start a combined audit
 *   Body: { url, company_id?, max_pages?, single_page?, analyses: ("freshness" | "links")[] }
 *   Response: { freshness_id?, link_id?, status: "running" }
 */

import type { NextApiRequest, NextApiResponse } from "next";
import { getSupabase } from "@/lib/supabase";
import { requireAuth, getUserAccounts } from "@/lib/auth";
import { deepCrawl, crawlSinglePage } from "@/lib/freshnessCrawler";
import { runAudit } from "@/lib/freshnessEngine";
import { runLinkAudit } from "@/lib/linkAuditEngine";
import { getCachedCrawl, setCrawlCache, cleanExpiredCache } from "@/lib/crawlCache";

export const config = {
    api: { responseLimit: false },
    maxDuration: 300,
};

type AnalysisType = "freshness" | "links";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== "POST") {
        return res.status(405).json({ error: "Method not allowed" });
    }

    const authUser = await requireAuth(req, res);
    if (!authUser) return;

    const accounts = await getUserAccounts(authUser.id);
    const accountId = accounts[0]?.account_id;
    if (!accountId) return res.status(400).json({ error: "No account found" });

    const { url, company_id, max_pages, single_page, analyses } = req.body ?? {};

    if (!url || typeof url !== "string" || url.trim().length < 4) {
        return res.status(400).json({ error: "A valid URL is required." });
    }

    const requestedAnalyses: AnalysisType[] = Array.isArray(analyses) && analyses.length > 0
        ? analyses.filter((a: string) => a === "freshness" || a === "links")
        : ["freshness", "links"]; // default: both

    if (requestedAnalyses.length === 0) {
        return res.status(400).json({ error: "At least one analysis type is required." });
    }

    const sb = getSupabase();
    const siteUrl = url.trim();
    const isSinglePage = !!single_page;
    const maxPageCount = max_pages ?? 50;

    // Create audit records for each requested analysis
    const result: { freshness_id?: string; link_id?: string; status: string } = { status: "running" };

    if (requestedAnalyses.includes("freshness")) {
        const { data, error } = await sb
            .from("freshness_audits")
            .insert({
                account_id: accountId,
                company_id: company_id || null,
                site_url: siteUrl,
                status: "running",
            })
            .select("id")
            .single();
        if (error) return res.status(500).json({ error: error.message });
        result.freshness_id = data.id;
    }

    if (requestedAnalyses.includes("links")) {
        const { data, error } = await sb
            .from("link_audits")
            .insert({
                account_id: accountId,
                company_id: company_id || null,
                site_url: siteUrl,
                status: "running",
            })
            .select("id")
            .single();
        if (error) return res.status(500).json({ error: error.message });
        result.link_id = data.id;
    }

    // Respond immediately
    res.status(200).json(result);

    // Fire-and-forget: run the combined pipeline
    runComboPipeline(
        sb, accountId, siteUrl, company_id,
        maxPageCount, isSinglePage,
        result.freshness_id, result.link_id
    ).catch((err) => {
        console.error(`[site-audit] Background pipeline error:`, err);
    });

    // Lazy cleanup of expired cache entries
    cleanExpiredCache().catch(() => {});
}

/**
 * Single crawl → fan out to both engines in parallel.
 */
async function runComboPipeline(
    sb: ReturnType<typeof getSupabase>,
    accountId: string,
    siteUrl: string,
    companyId: string | undefined,
    maxPages: number,
    singlePage: boolean,
    freshnessId: string | undefined,
    linkId: string | undefined,
) {
    // Helper: check if an audit was cancelled
    async function isCancelled(table: string, id: string): Promise<boolean> {
        const { data } = await sb.from(table).select("status").eq("id", id).single();
        return data?.status !== "running";
    }

    try {
        // ── Step 1: Crawl (with cache) ──────────────────────────────
        const scope = singlePage ? siteUrl : "deep";
        let crawlResult = await getCachedCrawl(accountId, siteUrl, scope);

        if (!crawlResult) {
            console.log(`[site-audit] Cache miss — crawling ${siteUrl}`);
            crawlResult = singlePage
                ? await crawlSinglePage(siteUrl)
                : await deepCrawl(siteUrl, { maxPages });

            if (crawlResult.pages_crawled > 0) {
                await setCrawlCache(accountId, siteUrl, scope, crawlResult);
            }
        }

        if (crawlResult.pages_crawled === 0) {
            const errorMsg = "No pages could be crawled. The website may be blocking automated requests.";
            if (freshnessId) {
                await sb.from("freshness_audits")
                    .update({ status: "failed", error: errorMsg, completed_at: new Date().toISOString() })
                    .eq("id", freshnessId).eq("status", "running");
            }
            if (linkId) {
                await sb.from("link_audits")
                    .update({ status: "failed", error: errorMsg, completed_at: new Date().toISOString() })
                    .eq("id", linkId).eq("status", "running");
            }
            return;
        }

        // Update pages_crawled on both records
        if (freshnessId) {
            await sb.from("freshness_audits")
                .update({ pages_crawled: crawlResult.pages_crawled, pages_discovered: crawlResult.pages_discovered })
                .eq("id", freshnessId).eq("status", "running");
        }
        if (linkId) {
            await sb.from("link_audits")
                .update({ pages_crawled: crawlResult.pages_crawled })
                .eq("id", linkId).eq("status", "running");
        }

        // ── Step 2: Run engines in parallel ─────────────────────────
        const tasks: Promise<void>[] = [];

        if (freshnessId) {
            tasks.push(
                runFreshnessEngine(sb, freshnessId, crawlResult, companyId, () => isCancelled("freshness_audits", freshnessId))
            );
        }

        if (linkId) {
            tasks.push(
                runLinkEngine(sb, linkId, crawlResult, () => isCancelled("link_audits", linkId))
            );
        }

        await Promise.allSettled(tasks);

    } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        if (freshnessId) {
            await sb.from("freshness_audits")
                .update({ status: "failed", error: message, completed_at: new Date().toISOString() })
                .eq("id", freshnessId).eq("status", "running");
        }
        if (linkId) {
            await sb.from("link_audits")
                .update({ status: "failed", error: message, completed_at: new Date().toISOString() })
                .eq("id", linkId).eq("status", "running");
        }
    }
}

/**
 * Run the freshness engine and update the freshness_audits table.
 */
async function runFreshnessEngine(
    sb: ReturnType<typeof getSupabase>,
    auditId: string,
    crawlResult: Awaited<ReturnType<typeof deepCrawl>>,
    companyId: string | undefined,
    isCancelled: () => Promise<boolean>,
) {
    try {
        if (await isCancelled()) return;

        const report = await runAudit(
            crawlResult,
            companyId || "",
            undefined,
            async (partialReport) => {
                await sb.from("freshness_audits")
                    .update({
                        pages_crawled: partialReport.pages_crawled,
                        total_facts: partialReport.total_facts_extracted,
                        issues_found: partialReport.issues_found,
                        critical_issues: partialReport.critical_issues,
                        overall_health: partialReport.overall_health,
                        report: partialReport,
                    })
                    .eq("id", auditId).eq("status", "running");
            }
        );

        await sb.from("freshness_audits")
            .update({
                status: "complete",
                pages_crawled: report.pages_crawled,
                pages_discovered: crawlResult.pages_discovered,
                total_facts: report.total_facts_extracted,
                issues_found: report.issues_found,
                critical_issues: report.critical_issues,
                overall_health: report.overall_health,
                report: { ...report, remaining_urls: crawlResult.remaining_urls, pages_discovered: crawlResult.pages_discovered },
                completed_at: new Date().toISOString(),
            })
            .eq("id", auditId).eq("status", "running");
    } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        await sb.from("freshness_audits")
            .update({ status: "failed", error: message, completed_at: new Date().toISOString() })
            .eq("id", auditId).eq("status", "running");
    }
}

/**
 * Run the link audit engine and update the link_audits table.
 */
async function runLinkEngine(
    sb: ReturnType<typeof getSupabase>,
    auditId: string,
    crawlResult: Awaited<ReturnType<typeof deepCrawl>>,
    isCancelled: () => Promise<boolean>,
) {
    try {
        if (await isCancelled()) return;

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
                    .eq("id", auditId).eq("status", "running");
            },
        });

        const reportForStorage = { ...report, all_links: undefined };

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
            .eq("id", auditId).eq("status", "running");
    } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        await sb.from("link_audits")
            .update({ status: "failed", error: message, completed_at: new Date().toISOString() })
            .eq("id", auditId).eq("status", "running");
    }
}
