/**
 * GET    /api/account/members  — List members of current account
 * DELETE /api/account/members  — Remove a member (owner/admin only)
 * PUT    /api/account/members  — Change a member's role (owner only)
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { getAdminSupabase } from "@/lib/supabase";
import { requireAuth, getUserAccounts, isPlatformAdmin } from "@/lib/auth";

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    const user = await requireAuth(req, res);
    if (!user) return;

    const admin = getAdminSupabase();
    const accountId =
        (req.query.account_id as string) || req.body?.account_id;

    if (!accountId) {
        return res.status(400).json({ error: "account_id is required" });
    }

    const accounts = await getUserAccounts(user.id);
    const isAdmin = await isPlatformAdmin(user.id);
    const membership = accounts.find((a) => a.account_id === accountId);

    if (!membership && !isAdmin) {
        return res.status(403).json({ error: "Access denied" });
    }

    try {
        if (req.method === "GET") {
            const { data, error } = await admin
                .from("account_members")
                .select("id, user_id, role, company_id, invited_at, accepted_at")
                .eq("account_id", accountId)
                .order("invited_at", { ascending: true });

            if (error) throw error;

            // Enrich with user email/name from auth.users
            const enriched = await Promise.all(
                (data || []).map(async (member) => {
                    const { data: userData } =
                        await admin.auth.admin.getUserById(member.user_id);
                    return {
                        ...member,
                        email: userData?.user?.email || "",
                        full_name:
                            userData?.user?.user_metadata?.full_name || "",
                    };
                })
            );

            return res.status(200).json(enriched);
        }

        if (req.method === "DELETE") {
            if (
                !isAdmin &&
                membership?.role !== "owner" &&
                membership?.role !== "admin"
            ) {
                return res
                    .status(403)
                    .json({ error: "Only owners can remove members" });
            }

            const { member_id } = req.body;
            if (!member_id) {
                return res
                    .status(400)
                    .json({ error: "member_id is required" });
            }

            // Prevent removing yourself
            const { data: targetMember } = await admin
                .from("account_members")
                .select("user_id")
                .eq("id", member_id)
                .single();

            if (targetMember?.user_id === user.id) {
                return res
                    .status(400)
                    .json({ error: "You cannot remove yourself" });
            }

            const { error } = await admin
                .from("account_members")
                .delete()
                .eq("id", member_id)
                .eq("account_id", accountId);

            if (error) throw error;
            return res.status(200).json({ success: true });
        }

        if (req.method === "PUT") {
            if (!isAdmin && membership?.role !== "owner") {
                return res
                    .status(403)
                    .json({ error: "Only owners can change roles" });
            }

            const { member_id, role, company_id } = req.body;
            if (!member_id || (!role && company_id === undefined)) {
                return res
                    .status(400)
                    .json({ error: "member_id and role or company_id are required" });
            }

            if (role && !["owner", "member"].includes(role)) {
                return res
                    .status(400)
                    .json({ error: "Invalid role. Must be 'owner' or 'member'" });
            }

            const updatePayload: Record<string, unknown> = {};
            if (role) updatePayload.role = role;
            if (company_id !== undefined) updatePayload.company_id = company_id || null;

            const { error } = await admin
                .from("account_members")
                .update(updatePayload)
                .eq("id", member_id)
                .eq("account_id", accountId);

            if (error) throw error;
            return res.status(200).json({ success: true });
        }

        return res.status(405).json({ error: "Method not allowed" });
    } catch (err) {
        console.error("Members API error:", err);
        const message = err instanceof Error ? err.message : "Server error";
        return res.status(500).json({ error: message });
    }
}
