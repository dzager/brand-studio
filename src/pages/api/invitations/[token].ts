/**
 * GET    /api/invitations/[token]  — Validate an invitation token
 * POST   /api/invitations/[token]  — Accept an invitation
 * DELETE /api/invitations/[token]  — Revoke a pending invitation (admin/owner only)
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { getAdminSupabase } from "@/lib/supabase";
import { requireAuth, getUserAccounts, isPlatformAdmin } from "@/lib/auth";

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    const { token } = req.query;

    if (typeof token !== "string" || !token) {
        return res.status(400).json({ error: "Invalid token" });
    }

    const admin = getAdminSupabase();

    try {
        // Look up the invitation
        const { data: invitation, error } = await admin
            .from("invitations")
            .select("*, accounts:account_id (name, slug, plan)")
            .eq("token", token)
            .single();

        if (error || !invitation) {
            return res.status(404).json({ error: "Invitation not found" });
        }

        // Check if already accepted
        if (invitation.accepted_at) {
            return res.status(410).json({ error: "This invitation has already been accepted" });
        }

        // Check if expired
        if (new Date(invitation.expires_at) < new Date()) {
            return res.status(410).json({ error: "This invitation has expired" });
        }

        if (req.method === "GET") {
            // Look up cluster name if cluster_id is set
            let clusterName: string | null = null;
            if (invitation.cluster_id) {
                const { data: cl } = await admin
                    .from("clusters")
                    .select("name")
                    .eq("id", invitation.cluster_id)
                    .single();
                clusterName = cl?.name || null;
            }

            return res.status(200).json({
                email: invitation.email,
                role: invitation.role,
                account_name: invitation.accounts?.name || "",
                account_slug: invitation.accounts?.slug || "",
                plan: invitation.accounts?.plan || "starter",
                cluster_id: invitation.cluster_id || null,
                cluster_name: clusterName,
            });
        }

        if (req.method === "POST") {
            const { password, full_name } = req.body;

            if (!password || typeof password !== "string" || password.length < 6) {
                return res.status(400).json({ error: "Password must be at least 6 characters" });
            }

            // Check if user already exists
            const { data: existingUsers } = await admin.auth.admin.listUsers();
            const existingUser = existingUsers?.users?.find(
                (u) => u.email?.toLowerCase() === invitation.email.toLowerCase()
            );

            let userId: string;

            if (existingUser) {
                userId = existingUser.id;
            } else {
                // Create new user
                const { data: newUser, error: createError } =
                    await admin.auth.admin.createUser({
                        email: invitation.email,
                        password,
                        email_confirm: true,
                        user_metadata: {
                            full_name: full_name?.trim() || "",
                        },
                    });

                if (createError) throw createError;
                userId = newUser.user.id;
            }

            let companyId: string | undefined;

            if (invitation.cluster_id) {
                const { data: clusterData } = await admin
                    .from("clusters")
                    .select("company_id")
                    .eq("id", invitation.cluster_id)
                    .single();
                
                if (clusterData?.company_id) {
                    companyId = clusterData.company_id;
                }
            }

            // Add to account_members
            const { error: memberError } = await admin
                .from("account_members")
                .upsert(
                    {
                        account_id: invitation.account_id,
                        user_id: userId,
                        role: invitation.role,
                        invited_by: invitation.invited_by,
                        accepted_at: new Date().toISOString(),
                        company_id: companyId || null,
                    },
                    { onConflict: "account_id,user_id" }
                );

            if (memberError) throw memberError;

            // Mark invitation as accepted
            await admin
                .from("invitations")
                .update({ accepted_at: new Date().toISOString() })
                .eq("id", invitation.id);

            return res.status(200).json({
                success: true,
                account_id: invitation.account_id,
                user_id: userId,
                is_new_user: !existingUser,
                cluster_id: invitation.cluster_id || null,
            });
        }

        if (req.method === "DELETE") {
            // Revoke a pending invitation — requires auth + owner/admin on the account
            const user = await requireAuth(req, res);
            if (!user) return;

            const isAdmin = await isPlatformAdmin(user.id);
            if (!isAdmin) {
                const accounts = await getUserAccounts(user.id);
                const membership = accounts.find((a) => a.account_id === invitation.account_id);
                if (!membership || (membership.role !== "owner" && membership.role !== "admin")) {
                    return res.status(403).json({ error: "Only owners can revoke invitations" });
                }
            }

            const { error: deleteError } = await admin
                .from("invitations")
                .delete()
                .eq("id", invitation.id);

            if (deleteError) throw deleteError;
            return res.status(200).json({ success: true });
        }

        return res.status(405).json({ error: "Method not allowed" });
    } catch (err) {
        console.error("Invitation token API error:", err);
        const message = err instanceof Error ? err.message : "Server error";
        return res.status(500).json({ error: message });
    }
}
