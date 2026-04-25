/**
 * Usage tracking utilities for billing enforcement.
 */
import { getAdminSupabase } from "@/lib/supabase";
import { getPlanLimits, type PlanId } from "@/lib/plans";

export interface UsageInfo {
    allowed: boolean;
    used: number;
    limit: number;
    overage: number;
    overagePrice: number;
    periodStart: string;
}

/**
 * Compute the billing period start date for an account based on plan_started_at.
 * If the account started on April 15, their billing periods are:
 *   Apr 15 – May 14, May 15 – Jun 14, etc.
 */
function computePeriodStart(planStartedAt: string): string {
    const start = new Date(planStartedAt);
    const now = new Date();

    const startDay = start.getDate();

    // Find the most recent period start
    let periodStart = new Date(now.getFullYear(), now.getMonth(), startDay);
    if (periodStart > now) {
        periodStart = new Date(now.getFullYear(), now.getMonth() - 1, startDay);
    }

    return periodStart.toISOString().split("T")[0]; // YYYY-MM-DD
}

/**
 * Get or create the usage record for the current billing period.
 */
export async function getOrCreateUsagePeriod(accountId: string): Promise<{
    id: string;
    articles_used: number;
    articles_limit: number;
    overage_count: number;
    period_start: string;
}> {
    const admin = getAdminSupabase();

    // Get account to determine plan and period
    const { data: account } = await admin
        .from("accounts")
        .select("plan, plan_started_at")
        .eq("id", accountId)
        .single();

    const plan = account?.plan || "starter";
    const planStartedAt = account?.plan_started_at || new Date().toISOString();
    const periodStart = computePeriodStart(planStartedAt);
    const limits = getPlanLimits(plan);

    // Try to get existing usage row
    const { data: existing } = await admin
        .from("account_usage")
        .select("*")
        .eq("account_id", accountId)
        .eq("period_start", periodStart)
        .single();

    if (existing) return existing;

    // Create new period
    const { data: created, error } = await admin
        .from("account_usage")
        .insert({
            account_id: accountId,
            period_start: periodStart,
            articles_limit: limits.articles_per_month,
            articles_used: 0,
            overage_count: 0,
        })
        .select()
        .single();

    if (error) {
        // Race condition: another request created it first
        const { data: retry } = await admin
            .from("account_usage")
            .select("*")
            .eq("account_id", accountId)
            .eq("period_start", periodStart)
            .single();

        if (retry) return retry;
        throw new Error(`Failed to create usage period: ${error.message}`);
    }

    return created;
}

/**
 * Check if the account can create another article.
 * Articles beyond the limit are allowed (overage billing) — the UI shows a warning.
 */
export async function checkArticleLimit(accountId: string): Promise<UsageInfo> {
    const usage = await getOrCreateUsagePeriod(accountId);

    const admin = getAdminSupabase();
    const { data: account } = await admin
        .from("accounts")
        .select("plan")
        .eq("id", accountId)
        .single();

    const plan = (account?.plan || "starter") as PlanId;
    const limits = getPlanLimits(plan);

    const overage = Math.max(0, usage.articles_used - usage.articles_limit);

    return {
        allowed: true, // overage is always allowed (billed separately)
        used: usage.articles_used,
        limit: usage.articles_limit,
        overage,
        overagePrice: limits.overage_price,
        periodStart: usage.period_start,
    };
}

/**
 * Atomically increment the article count after a successful creation.
 */
export async function incrementArticleCount(accountId: string): Promise<void> {
    const usage = await getOrCreateUsagePeriod(accountId);
    const admin = getAdminSupabase();

    const newUsed = usage.articles_used + 1;
    const newOverage =
        newUsed > usage.articles_limit
            ? usage.overage_count + 1
            : usage.overage_count;

    await admin
        .from("account_usage")
        .update({
            articles_used: newUsed,
            overage_count: newOverage,
        })
        .eq("id", usage.id);
}

/**
 * Get a summary of the account's usage for display.
 */
export async function getAccountUsageSummary(accountId: string) {
    const usage = await getOrCreateUsagePeriod(accountId);

    const admin = getAdminSupabase();
    const { data: account } = await admin
        .from("accounts")
        .select("plan")
        .eq("id", accountId)
        .single();

    const plan = (account?.plan || "starter") as PlanId;
    const limits = getPlanLimits(plan);

    return {
        plan,
        planLabel: limits.label,
        articlesUsed: usage.articles_used,
        articlesLimit: usage.articles_limit,
        overage: usage.overage_count,
        overagePrice: limits.overage_price,
        overageCost: usage.overage_count * limits.overage_price,
        periodStart: usage.period_start,
        percentUsed: Math.round(
            (usage.articles_used / usage.articles_limit) * 100
        ),
    };
}
