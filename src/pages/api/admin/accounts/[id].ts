/**
 * GET /api/admin/accounts/[id] — Account detail with full usage history
 * PUT /api/admin/accounts/[id] — Admin actions (change plan, suspend, trigger invoice)
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { requireAuth, isPlatformAdmin } from "@/lib/auth";
import { getAdminSupabase } from "@/lib/supabase";
import { stripe, STRIPE_OVERAGE_PRICES } from "@/lib/stripe";
import { PLAN_LIMITS, type PlanId } from "@/lib/plans";

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    const user = await requireAuth(req, res);
    if (!user) return;

    if (!(await isPlatformAdmin(user.id))) {
        return res.status(403).json({ error: "Admin access required" });
    }

    const { id } = req.query;
    if (typeof id !== "string") {
        return res.status(400).json({ error: "Invalid account id" });
    }

    const admin = getAdminSupabase();

    try {
        if (req.method === "GET") {
            // Account details
            const { data: account, error } = await admin
                .from("accounts")
                .select("*")
                .eq("id", id)
                .single();

            if (error || !account) {
                return res.status(404).json({ error: "Account not found" });
            }

            // Members
            const { data: members } = await admin
                .from("account_members")
                .select("id, user_id, role, invited_at, accepted_at")
                .eq("account_id", id);

            const enrichedMembers = await Promise.all(
                (members || []).map(async (m) => {
                    const { data: userData } =
                        await admin.auth.admin.getUserById(m.user_id);
                    return {
                        ...m,
                        email: userData?.user?.email || "",
                        full_name:
                            userData?.user?.user_metadata?.full_name || "",
                    };
                })
            );

            // Companies
            const { data: companies } = await admin
                .from("companies")
                .select("id, name, created_at")
                .eq("account_id", id);

            // Usage history (last 12 periods)
            const { data: usageHistory } = await admin
                .from("account_usage")
                .select("*")
                .eq("account_id", id)
                .order("period_start", { ascending: false })
                .limit(12);

            // Pending invitations
            const { data: invitations } = await admin
                .from("invitations")
                .select("*")
                .eq("account_id", id)
                .is("accepted_at", null);

            return res.status(200).json({
                account,
                members: enrichedMembers,
                companies: companies || [],
                usage_history: usageHistory || [],
                invitations: invitations || [],
            });
        }

        if (req.method === "PUT") {
            const { action: adminAction } = req.body;

            switch (adminAction) {
                case "change-plan": {
                    const { plan } = req.body;
                    if (!plan || !PLAN_LIMITS[plan as PlanId]) {
                        return res
                            .status(400)
                            .json({ error: "Invalid plan" });
                    }

                    await admin
                        .from("accounts")
                        .update({ plan })
                        .eq("id", id);

                    return res.status(200).json({ success: true, plan });
                }

                case "suspend": {
                    await admin
                        .from("accounts")
                        .update({ stripe_status: "cancelled" })
                        .eq("id", id);

                    return res.status(200).json({ success: true });
                }

                case "reactivate": {
                    await admin
                        .from("accounts")
                        .update({ stripe_status: "active" })
                        .eq("id", id);

                    return res.status(200).json({ success: true });
                }

                case "trigger-overage-invoice": {
                    const { data: account } = await admin
                        .from("accounts")
                        .select("stripe_customer_id, plan")
                        .eq("id", id)
                        .single();

                    if (!account?.stripe_customer_id) {
                        return res.status(400).json({
                            error: "No Stripe customer linked",
                        });
                    }

                    // Get current usage
                    const today = new Date();
                    const periodMonth = today.toISOString().slice(0, 7);

                    const { data: usage } = await admin
                        .from("account_usage")
                        .select("overage_count")
                        .eq("account_id", id)
                        .gte("period_start", `${periodMonth}-01`)
                        .order("period_start", { ascending: false })
                        .limit(1)
                        .single();

                    const overageCount = usage?.overage_count || 0;
                    if (overageCount === 0) {
                        return res
                            .status(400)
                            .json({ error: "No overage to invoice" });
                    }

                    const plan = (account.plan || "starter") as PlanId;
                    const overagePrice = PLAN_LIMITS[plan].overage_price;
                    const totalCents = Math.round(
                        overageCount * overagePrice * 100
                    );

                    // Create invoice item
                    await stripe.invoiceItems.create({
                        customer: account.stripe_customer_id,
                        amount: totalCents,
                        currency: "usd",
                        description: `Overage: ${overageCount} extra articles @ $${overagePrice.toFixed(2)}/article`,
                    });

                    // Create and send invoice
                    const invoice = await stripe.invoices.create({
                        customer: account.stripe_customer_id,
                        auto_advance: true,
                    });

                    await stripe.invoices.sendInvoice(invoice.id);

                    return res.status(200).json({
                        success: true,
                        invoice_id: invoice.id,
                        amount: totalCents / 100,
                    });
                }

                case "delete": {
                    // Cancel Stripe subscription if one exists
                    const { data: acctToDelete } = await admin
                        .from("accounts")
                        .select("stripe_subscription_id, stripe_customer_id")
                        .eq("id", id)
                        .single();

                    if (acctToDelete?.stripe_subscription_id) {
                        try {
                            await stripe.subscriptions.cancel(
                                acctToDelete.stripe_subscription_id
                            );
                        } catch (stripeErr) {
                            console.warn(
                                "Failed to cancel Stripe subscription during delete:",
                                stripeErr
                            );
                        }
                    }

                    // Delete the account — CASCADE handles members, usage, invitations,
                    // and nullifies account_id on companies/articles/clusters
                    const { error: deleteErr } = await admin
                        .from("accounts")
                        .delete()
                        .eq("id", id);

                    if (deleteErr) throw deleteErr;

                    return res.status(200).json({ success: true, deleted: true });
                }

                default:
                    return res
                        .status(400)
                        .json({ error: "Invalid action" });
            }
        }

        return res.status(405).json({ error: "Method not allowed" });
    } catch (err) {
        console.error("Admin account detail API error:", err);
        const message = err instanceof Error ? err.message : "Server error";
        return res.status(500).json({ error: message });
    }
}
