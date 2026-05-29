/**
 * Plan limits configuration — matches the pricing tiers on the landing page.
 * Single source of truth for all plan-based enforcement.
 */

export type PlanId = "starter" | "standard" | "scale";

export interface PlanLimits {
    label: string;
    price_monthly: number;
    articles_per_month: number;
    overage_price: number;
    max_seats: number;
    extra_seat_price: number;
    max_domains: number;
    api_access: boolean;
}

export const PLAN_LIMITS: Record<PlanId, PlanLimits> = {
    starter: {
        label: "Starter",
        price_monthly: 99,
        articles_per_month: 200,
        overage_price: 3.5,
        max_seats: 1,
        extra_seat_price: 0,
        max_domains: 5,
        api_access: false,
    },
    standard: {
        label: "Standard",
        price_monthly: 299,
        articles_per_month: 80,
        overage_price: 3.0,
        max_seats: 3,
        extra_seat_price: 25,
        max_domains: Infinity,
        api_access: true,
    },
    scale: {
        label: "Scale",
        price_monthly: 999,
        articles_per_month: 300,
        overage_price: 2.5,
        max_seats: 10,
        extra_seat_price: 20,
        max_domains: Infinity,
        api_access: true,
    },
} as const;

/** Check if a plan ID is valid */
export function isValidPlan(plan: string): plan is PlanId {
    return plan in PLAN_LIMITS;
}

/** Get limits for a plan, defaulting to starter if unknown */
export function getPlanLimits(plan: string): PlanLimits {
    return PLAN_LIMITS[plan as PlanId] ?? PLAN_LIMITS.starter;
}
