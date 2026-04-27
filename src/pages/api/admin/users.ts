/**
 * GET  /api/admin/users — List all platform users (admin only)
 * DELETE /api/admin/users?id=<user_id> — Remove a user from the platform
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { requireAuth, isPlatformAdmin } from "@/lib/auth";
import { getAdminSupabase } from "@/lib/supabase";

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    const user = await requireAuth(req, res);
    if (!user) return;

    if (!(await isPlatformAdmin(user.id))) {
        return res.status(403).json({ error: "Admin access required" });
    }

    const admin = getAdminSupabase();

    try {
        if (req.method === "GET") {
            // List all auth users (paginated — Supabase defaults to 50 per page)
            const { data: authData, error: authError } =
                await admin.auth.admin.listUsers({ page: 1, perPage: 500 });

            if (authError) throw authError;

            const authUsers = authData?.users || [];

            // Get all account memberships in one query
            const { data: memberships } = await admin
                .from("account_members")
                .select(
                    `
                    user_id,
                    role,
                    company_id,
                    accounts:account_id (
                        id,
                        name,
                        plan,
                        stripe_status
                    )
                `
                );

            // Get platform admins
            const { data: platformAdmins } = await admin
                .from("platform_admins")
                .select("user_id");

            const adminSet = new Set(
                (platformAdmins || []).map((a: any) => a.user_id)
            );

            // Build membership lookup by user_id
            const membershipMap: Record<string, any[]> = {};
            for (const m of memberships || []) {
                if (!membershipMap[m.user_id]) membershipMap[m.user_id] = [];
                membershipMap[m.user_id].push({
                    role: m.role,
                    company_id: m.company_id,
                    account_id: (m as any).accounts?.id || null,
                    account_name: (m as any).accounts?.name || "",
                    plan: (m as any).accounts?.plan || "starter",
                    stripe_status: (m as any).accounts?.stripe_status || null,
                });
            }

            const users = authUsers.map((u: any) => ({
                id: u.id,
                email: u.email || "",
                full_name: u.user_metadata?.full_name || "",
                avatar_url: u.user_metadata?.avatar_url || null,
                created_at: u.created_at,
                last_sign_in_at: u.last_sign_in_at || null,
                email_confirmed_at: u.email_confirmed_at || null,
                is_platform_admin: adminSet.has(u.id),
                accounts: membershipMap[u.id] || [],
            }));

            // Sort by most recent first
            users.sort(
                (a: any, b: any) =>
                    new Date(b.created_at).getTime() -
                    new Date(a.created_at).getTime()
            );

            return res.status(200).json(users);
        }

        if (req.method === "DELETE") {
            const { id: targetUserId } = req.query;
            if (typeof targetUserId !== "string") {
                return res.status(400).json({ error: "User id is required" });
            }

            // Don't allow deleting yourself
            if (targetUserId === user.id) {
                return res
                    .status(400)
                    .json({ error: "Cannot delete your own account" });
            }

            // Remove account memberships
            await admin
                .from("account_members")
                .delete()
                .eq("user_id", targetUserId);

            // Remove from platform_admins if applicable
            await admin
                .from("platform_admins")
                .delete()
                .eq("user_id", targetUserId);

            // Delete the auth user
            const { error: deleteError } =
                await admin.auth.admin.deleteUser(targetUserId);

            if (deleteError) throw deleteError;

            return res.status(200).json({ success: true, deleted: true });
        }

        return res.status(405).json({ error: "Method not allowed" });
    } catch (err) {
        console.error("Admin users API error:", err);
        const message = err instanceof Error ? err.message : "Server error";
        return res.status(500).json({ error: message });
    }
}
