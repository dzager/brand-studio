/**
 * GET  /api/invitations        — List pending invitations for the current account
 * POST /api/invitations        — Create a new invitation (owner/admin only)
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { createServerSupabase, getAdminSupabase } from "@/lib/supabase";
import { requireAuth, getUserAccounts, isPlatformAdmin } from "@/lib/auth";
import { getPlanLimits } from "@/lib/plans";
import { sendClusterInviteEmail, buildInviteUrl } from "@/lib/email";

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    const user = await requireAuth(req, res);
    if (!user) return;

    const admin = getAdminSupabase();
    let accountId = (req.query.account_id as string) || req.body?.account_id;

    // Auto-resolve account_id from cluster_id if not provided
    if (!accountId && req.body?.cluster_id) {
        const { data: clusterRow } = await admin
            .from("clusters")
            .select("account_id")
            .eq("id", req.body.cluster_id)
            .single();
        if (clusterRow?.account_id) {
            accountId = clusterRow.account_id;
        }
    }

    // Final fallback: use the authenticated user's own account
    if (!accountId) {
        const accounts = await getUserAccounts(user.id);
        if (accounts.length > 0) {
            accountId = accounts[0].account_id;
        }
    }

    if (!accountId) {
        return res.status(400).json({ error: "account_id is required" });
    }

    // Verify user has access to this account
    const accounts = await getUserAccounts(user.id);
    const isAdmin = await isPlatformAdmin(user.id);
    const membership = accounts.find((a) => a.account_id === accountId);

    if (!membership && !isAdmin) {
        return res.status(403).json({ error: "Access denied" });
    }

    try {
        if (req.method === "GET") {
            let query = admin
                .from("invitations")
                .select("*")
                .eq("account_id", accountId)
                .is("accepted_at", null)
                .order("created_at", { ascending: false });

            // Optionally filter by cluster_id
            const filterClusterId = req.query.cluster_id as string;
            if (filterClusterId) {
                query = query.eq("cluster_id", filterClusterId);
            }

            const { data, error } = await query;

            if (error) throw error;
            return res.status(200).json(data);
        }

        if (req.method === "POST") {
            // Only owners and admins can invite
            if (
                !isAdmin &&
                membership?.role !== "owner" &&
                membership?.role !== "admin"
            ) {
                return res.status(403).json({ error: "Only owners can invite members" });
            }

            const { email, role, cluster_id } = req.body;

            if (!email || typeof email !== "string" || !email.includes("@")) {
                return res.status(400).json({ error: "Valid email is required" });
            }

            const inviteRole = role === "owner" ? "owner" : "member";

            // Check seat limits
            const { data: account } = await admin
                .from("accounts")
                .select("plan")
                .eq("id", accountId)
                .single();

            const limits = getPlanLimits(account?.plan || "starter");

            const { count: memberCount } = await admin
                .from("account_members")
                .select("*", { count: "exact", head: true })
                .eq("account_id", accountId);

            const { count: pendingCount } = await admin
                .from("invitations")
                .select("*", { count: "exact", head: true })
                .eq("account_id", accountId)
                .is("accepted_at", null);

            const totalSeats = (memberCount || 0) + (pendingCount || 0);

            // Seat limits are tracked but no longer block invitations
            // All plans (including Starter) can invite collaborators

            // Check for duplicate invitation
            const { data: existing } = await admin
                .from("invitations")
                .select("*")
                .eq("account_id", accountId)
                .eq("email", email.trim().toLowerCase())
                .is("accepted_at", null)
                .limit(1)
                .maybeSingle();

            let invitation;
            if (existing) {
                // If the user has already been invited, update their invitation and resend the email
                const { data: updatedInvite, error: updateError } = await admin
                    .from("invitations")
                    .update({
                        cluster_id: cluster_id || existing.cluster_id,
                        role: inviteRole,
                        invited_by: user.id,
                        created_at: new Date().toISOString() // Refresh the timestamp
                    })
                    .eq("id", existing.id)
                    .select()
                    .single();

                if (updateError) throw updateError;
                invitation = updatedInvite;
            } else {
                // Create new invitation
                const { data: newInvite, error: insertError } = await admin
                    .from("invitations")
                    .insert({
                        account_id: accountId,
                        email: email.trim().toLowerCase(),
                        role: inviteRole,
                        invited_by: user.id,
                        cluster_id: cluster_id || null,
                    })
                    .select()
                    .single();

                if (insertError) throw insertError;
                invitation = newInvite;
            }

            // Send invitation email
            let clusterName: string | null = null;
            if (cluster_id) {
                const { data: cl } = await admin
                    .from("clusters")
                    .select("name")
                    .eq("id", cluster_id)
                    .single();
                clusterName = cl?.name || null;
            }

            // Look up account name for the email
            const { data: acctData } = await admin
                .from("accounts")
                .select("name")
                .eq("id", accountId)
                .single();

            const inviteUrl = buildInviteUrl(invitation.token);

            // Fire-and-forget email — don't block the response
            sendClusterInviteEmail({
                to: email.trim().toLowerCase(),
                inviterName: user.email || "A team member",
                accountName: acctData?.name || "your team",
                clusterName,
                inviteUrl,
            }).catch((emailErr) =>
                console.error("[invitations] Email delivery failed:", emailErr)
            );

            return res.status(201).json({
                ...invitation,
                invite_url: inviteUrl,
            });
        }

        return res.status(405).json({ error: "Method not allowed" });
    } catch (err) {
        console.error("Invitations API error:", err);
        const message = err instanceof Error ? err.message : "Server error";
        return res.status(500).json({ error: message });
    }
}
