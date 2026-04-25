/**
 * POST /api/admin/stripe-webhook
 *
 * Handles Stripe webhook events for subscription lifecycle management.
 * Verifies event signatures using STRIPE_WEBHOOK_SECRET.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { stripe } from "@/lib/stripe";
import { getAdminSupabase } from "@/lib/supabase";
import { getPlanLimits } from "@/lib/plans";
import type Stripe from "stripe";

// Disable body parsing so we can read the raw body for signature verification
export const config = {
    api: {
        bodyParser: false,
    },
};

async function readRawBody(req: NextApiRequest): Promise<Buffer> {
    const chunks: Uint8Array[] = [];
    for await (const chunk of req) {
        chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
    }
    return Buffer.concat(chunks);
}

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    if (req.method !== "POST") {
        return res.status(405).json({ error: "Method not allowed" });
    }

    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
        console.error("Missing STRIPE_WEBHOOK_SECRET");
        return res.status(500).json({ error: "Webhook secret not configured" });
    }

    const rawBody = await readRawBody(req);
    const signature = req.headers["stripe-signature"] as string;

    let event: Stripe.Event;

    try {
        event = stripe.webhooks.constructEvent(
            rawBody,
            signature,
            webhookSecret
        );
    } catch (err) {
        console.error("Webhook signature verification failed:", err);
        return res.status(400).json({ error: "Invalid signature" });
    }

    const admin = getAdminSupabase();

    try {
        switch (event.type) {
            case "checkout.session.completed": {
                const session = event.data
                    .object as Stripe.Checkout.Session;
                const accountId = session.metadata?.account_id;
                const plan = session.metadata?.plan;

                if (accountId) {
                    await admin
                        .from("accounts")
                        .update({
                            stripe_customer_id: session.customer as string,
                            stripe_subscription_id:
                                session.subscription as string,
                            stripe_status: "active",
                            plan: plan || "starter",
                        })
                        .eq("id", accountId);

                    console.log(
                        `[stripe-webhook] checkout.session.completed → account ${accountId} activated`
                    );
                }
                break;
            }

            case "customer.subscription.updated": {
                const subscription = event.data
                    .object as Stripe.Subscription;
                const accountId = subscription.metadata?.account_id;

                if (accountId) {
                    const status = subscription.status;
                    const mappedStatus =
                        status === "active"
                            ? "active"
                            : status === "past_due"
                              ? "past_due"
                              : status === "trialing"
                                ? "trialing"
                                : "cancelled";

                    await admin
                        .from("accounts")
                        .update({ stripe_status: mappedStatus })
                        .eq("id", accountId);

                    console.log(
                        `[stripe-webhook] subscription.updated → account ${accountId} status: ${mappedStatus}`
                    );
                }
                break;
            }

            case "customer.subscription.deleted": {
                const subscription = event.data
                    .object as Stripe.Subscription;
                const accountId = subscription.metadata?.account_id;

                if (accountId) {
                    await admin
                        .from("accounts")
                        .update({ stripe_status: "cancelled" })
                        .eq("id", accountId);

                    console.log(
                        `[stripe-webhook] subscription.deleted → account ${accountId} cancelled`
                    );
                }
                break;
            }

            case "invoice.paid": {
                const invoiceObj = event.data.object as Record<string, any>;
                const subscriptionId =
                    typeof invoiceObj.subscription === "string"
                        ? invoiceObj.subscription
                        : invoiceObj.subscription?.toString() || null;

                if (subscriptionId) {
                    // Find the account
                    const { data: account } = await admin
                        .from("accounts")
                        .select("id, plan")
                        .eq("stripe_subscription_id", subscriptionId)
                        .single();

                    if (account) {
                        // Create a new usage period for the next billing cycle
                        const limits = getPlanLimits(account.plan);
                        const today = new Date().toISOString().split("T")[0];

                        await admin.from("account_usage").upsert(
                            {
                                account_id: account.id,
                                period_start: today,
                                articles_limit: limits.articles_per_month,
                                articles_used: 0,
                                overage_count: 0,
                            },
                            { onConflict: "account_id,period_start" }
                        );

                        console.log(
                            `[stripe-webhook] invoice.paid → account ${account.id} usage reset`
                        );
                    }
                }
                break;
            }

            case "invoice.payment_failed": {
                const failedInvoice = event.data.object as Record<string, any>;
                const failedSubId =
                    typeof failedInvoice.subscription === "string"
                        ? failedInvoice.subscription
                        : failedInvoice.subscription?.toString() || null;

                if (failedSubId) {
                    await admin
                        .from("accounts")
                        .update({ stripe_status: "past_due" })
                        .eq("stripe_subscription_id", failedSubId);

                    console.log(
                        `[stripe-webhook] invoice.payment_failed → subscription ${failedSubId}`
                    );
                }
                break;
            }

            default:
                console.log(`[stripe-webhook] Unhandled event: ${event.type}`);
        }

        return res.status(200).json({ received: true });
    } catch (err) {
        console.error("Webhook handler error:", err);
        return res.status(500).json({ error: "Webhook processing failed" });
    }
}
