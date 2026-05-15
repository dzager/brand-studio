/**
 * POST /api/account/billing
 *
 * Actions:
 *   - create-checkout  → Creates Stripe Checkout Session
 *   - create-portal    → Creates Stripe Billing Portal session
 *   - change-plan      → Upgrades/downgrades subscription
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { requireAuth, getUserAccounts, isPlatformAdmin } from "@/lib/auth";
import { getAdminSupabase } from "@/lib/supabase";
import { stripe, STRIPE_PRICES } from "@/lib/stripe";
import { isValidPlan, type PlanId } from "@/lib/plans";

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    if (req.method !== "POST") {
        return res.status(405).json({ error: "Method not allowed" });
    }

    const user = await requireAuth(req, res);
    if (!user) return;

    const { action, account_id, plan } = req.body;

    if (!account_id) {
        return res.status(400).json({ error: "account_id is required" });
    }

    // Verify access
    const accounts = await getUserAccounts(user.id);
    const isAdmin = await isPlatformAdmin(user.id);
    const membership = accounts.find((a) => a.account_id === account_id);

    if (!membership && !isAdmin) {
        return res.status(403).json({ error: "Access denied" });
    }

    // Only owners can manage billing
    if (!isAdmin && membership?.role !== "owner") {
        return res
            .status(403)
            .json({ error: "Only account owners can manage billing" });
    }

    const admin = getAdminSupabase();

    try {
        const { data: account } = await admin
            .from("accounts")
            .select("*")
            .eq("id", account_id)
            .single();

        if (!account) {
            return res.status(404).json({ error: "Account not found" });
        }

        switch (action) {
            case "create-checkout": {
                const selectedPlan: PlanId = isValidPlan(plan)
                    ? plan
                    : "starter";
                const priceId =
                    STRIPE_PRICES[selectedPlan];

                if (!priceId) {
                    return res.status(400).json({
                        error: "Stripe price not configured for this plan",
                    });
                }

                const session = await stripe.checkout.sessions.create({
                    mode: "subscription",
                    customer_email: account.stripe_customer_id
                        ? undefined
                        : user.email,
                    customer: account.stripe_customer_id || undefined,
                    line_items: [{ price: priceId, quantity: 1 }],
                    success_url: `${req.headers.origin}/articles?checkout=success`,
                    cancel_url: `${req.headers.origin}/register?checkout=cancelled`,
                    metadata: {
                        account_id: account.id,
                        plan: selectedPlan,
                    },
                    subscription_data: {
                        metadata: {
                            account_id: account.id,
                        },
                    },
                });

                return res
                    .status(200)
                    .json({ url: session.url, session_id: session.id });
            }

            case "create-portal": {
                if (!account.stripe_customer_id) {
                    return res.status(400).json({
                        error: "No Stripe customer linked to this account",
                    });
                }

                const portal =
                    await stripe.billingPortal.sessions.create({
                        customer: account.stripe_customer_id,
                        return_url: `${req.headers.origin}/articles`,
                    });

                return res.status(200).json({ url: portal.url });
            }

            case "change-plan": {
                if (!account.stripe_subscription_id) {
                    return res.status(400).json({
                        error: "No active subscription to modify",
                    });
                }

                const newPlan: PlanId = isValidPlan(plan) ? plan : "starter";
                const newPriceId = STRIPE_PRICES[newPlan];

                if (!newPriceId) {
                    return res.status(400).json({
                        error: "Stripe price not configured",
                    });
                }

                // Get current subscription
                const subscription = await stripe.subscriptions.retrieve(
                    account.stripe_subscription_id
                );
                const currentItem = subscription.items.data[0];

                // Update the subscription
                await stripe.subscriptions.update(
                    account.stripe_subscription_id,
                    {
                        items: [
                            {
                                id: currentItem.id,
                                price: newPriceId,
                            },
                        ],
                        proration_behavior: "create_prorations",
                        metadata: {
                            account_id: account.id,
                            plan: newPlan,
                        },
                    }
                );

                // Update local plan
                await admin
                    .from("accounts")
                    .update({ plan: newPlan })
                    .eq("id", account.id);

                return res.status(200).json({ success: true, plan: newPlan });
            }

            default:
                return res
                    .status(400)
                    .json({ error: "Invalid action" });
        }
    } catch (err) {
        console.error("Billing API error:", err);
        const message = err instanceof Error ? err.message : "Server error";
        return res.status(500).json({ error: message });
    }
}
