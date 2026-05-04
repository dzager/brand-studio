/**
 * POST /api/account/sync-usage — Reconcile the usage counter with the actual
 * article count from the articles table for the current billing period.
 *
 * This corrects any drift caused by articles that were created without
 * incrementing the counter (e.g. cluster-generated articles before the fix).
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { requireAuth, getUserAccounts, isPlatformAdmin } from "@/lib/auth";
import { getOrCreateUsagePeriod } from "@/lib/usage";
import { getAdminSupabase } from "@/lib/supabase";

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    if (req.method !== "POST") {
        return res.status(405).json({ error: "Method not allowed" });
    }

    const user = await requireAuth(req, res);
    if (!user) return;

    const accountId = req.body?.account_id || (req.query.account_id as string);
    if (!accountId) {
        return res.status(400).json({ error: "account_id is required" });
    }

    // Verify access
    const accounts = await getUserAccounts(user.id);
    const isAdmin = await isPlatformAdmin(user.id);
    const hasAccess = isAdmin || accounts.some((a) => a.account_id === accountId);

    if (!hasAccess) {
        return res.status(403).json({ error: "Access denied" });
    }

    try {
        const admin = getAdminSupabase();
        const usage = await getOrCreateUsagePeriod(accountId);

        // First, backfill account_id on articles that are missing it
        // (cluster-generated articles before the fix didn't set account_id)
        const { data: accountCompanies } = await admin
            .from("companies")
            .select("id")
            .eq("account_id", accountId);

        if (accountCompanies && accountCompanies.length > 0) {
            const companyIds = accountCompanies.map((c) => c.id);
            await admin
                .from("articles")
                .update({ account_id: accountId })
                .is("account_id", null)
                .in("company_id", companyIds);
        }

        // Now count actual articles created since the period start
        const { count, error: countErr } = await admin
            .from("articles")
            .select("id", { count: "exact", head: true })
            .eq("account_id", accountId)
            .gte("created_at", usage.period_start);

        if (countErr) throw countErr;

        const actualCount = count ?? 0;
        const previousCount = usage.articles_used;

        if (actualCount !== previousCount) {
            const newOverage = Math.max(0, actualCount - usage.articles_limit);
            await admin
                .from("account_usage")
                .update({
                    articles_used: actualCount,
                    overage_count: newOverage,
                })
                .eq("id", usage.id);

            console.log(
                `[sync-usage] Account ${accountId}: corrected ${previousCount} → ${actualCount} articles (period: ${usage.period_start})`
            );
        }

        return res.status(200).json({
            synced: true,
            previous: previousCount,
            actual: actualCount,
            corrected: actualCount !== previousCount,
            period_start: usage.period_start,
        });
    } catch (err) {
        console.error("Sync usage error:", err);
        const message = err instanceof Error ? err.message : "Server error";
        return res.status(500).json({ error: message });
    }
}
