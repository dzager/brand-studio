/**
 * GET /api/admin/accounts — All accounts with usage, members, Stripe status
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { requireAuth, isPlatformAdmin } from "@/lib/auth";
import { getAdminSupabase } from "@/lib/supabase";
import { PLAN_LIMITS, type PlanId } from "@/lib/plans";

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    if (req.method !== "GET") {
        return res.status(405).json({ error: "Method not allowed" });
    }

    const user = await requireAuth(req, res);
    if (!user) return;

    if (!(await isPlatformAdmin(user.id))) {
        return res.status(403).json({ error: "Admin access required" });
    }

    const admin = getAdminSupabase();

    try {
        // Get all accounts
        const { data: accounts, error } = await admin
            .from("accounts")
            .select("*")
            .order("created_at", { ascending: false });

        if (error) throw error;

        // Enrich with member counts, company counts, and current usage
        const enriched = await Promise.all(
            (accounts || []).map(async (account) => {
                // Member count
                const { count: memberCount } = await admin
                    .from("account_members")
                    .select("*", { count: "exact", head: true })
                    .eq("account_id", account.id);

                // Company count
                const { count: companyCount } = await admin
                    .from("companies")
                    .select("*", { count: "exact", head: true })
                    .eq("account_id", account.id);

                // Current period usage
                const today = new Date();
                const periodMonth = today.toISOString().slice(0, 7);

                const { data: usage } = await admin
                    .from("account_usage")
                    .select("articles_used, articles_limit, overage_count")
                    .eq("account_id", account.id)
                    .gte("period_start", `${periodMonth}-01`)
                    .order("period_start", { ascending: false })
                    .limit(1)
                    .single();

                const limits =
                    PLAN_LIMITS[account.plan as PlanId] || PLAN_LIMITS.starter;

                return {
                    ...account,
                    member_count: memberCount || 0,
                    company_count: companyCount || 0,
                    articles_used: usage?.articles_used || 0,
                    articles_limit: usage?.articles_limit || limits.articles_per_month,
                    overage_count: usage?.overage_count || 0,
                    overage_cost:
                        (usage?.overage_count || 0) * limits.overage_price,
                    mrr: limits.price_monthly,
                };
            })
        );

        return res.status(200).json(enriched);
    } catch (err) {
        console.error("Admin accounts API error:", err);
        const message = err instanceof Error ? err.message : "Server error";
        return res.status(500).json({ error: message });
    }
}
