/**
 * PUT /api/account/update — Update account details (name, slug)
 * Only owners/admins of the account (or platform admins) can update.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { getAdminSupabase } from "@/lib/supabase";
import { requireAuth, getUserAccounts, isPlatformAdmin } from "@/lib/auth";

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    if (req.method !== "PUT") {
        return res.status(405).json({ error: "Method not allowed" });
    }

    const user = await requireAuth(req, res);
    if (!user) return;

    const { account_id, name, slug } = req.body;

    if (!account_id) {
        return res.status(400).json({ error: "account_id is required" });
    }

    // Verify access — must be owner/admin of the account or platform admin
    const accounts = await getUserAccounts(user.id);
    const isAdmin = await isPlatformAdmin(user.id);
    const membership = accounts.find((a) => a.account_id === account_id);

    if (!membership && !isAdmin) {
        return res.status(403).json({ error: "Access denied" });
    }

    if (!isAdmin && membership?.role !== "owner" && membership?.role !== "admin") {
        return res.status(403).json({ error: "Only account owners and admins can update account details" });
    }

    // Validate inputs
    const updates: Record<string, string> = {};

    if (typeof name === "string") {
        const trimmed = name.trim();
        if (trimmed.length < 1 || trimmed.length > 100) {
            return res.status(400).json({ error: "Account name must be 1–100 characters" });
        }
        updates.name = trimmed;
    }

    if (typeof slug === "string") {
        const trimmed = slug.trim().toLowerCase();
        if (!/^[a-z0-9](?:[a-z0-9-]{0,48}[a-z0-9])?$/.test(trimmed)) {
            return res.status(400).json({
                error: "Slug must be 1–50 lowercase characters, numbers, or hyphens. Must start and end with a letter or number.",
            });
        }
        updates.slug = trimmed;
    }

    if (Object.keys(updates).length === 0) {
        return res.status(400).json({ error: "No fields to update" });
    }

    const admin = getAdminSupabase();

    try {
        // If slug is being changed, check for uniqueness
        if (updates.slug) {
            const { data: existing } = await admin
                .from("accounts")
                .select("id")
                .eq("slug", updates.slug)
                .neq("id", account_id)
                .single();

            if (existing) {
                return res.status(409).json({ error: "This slug is already taken" });
            }
        }

        const { data, error } = await admin
            .from("accounts")
            .update(updates)
            .eq("id", account_id)
            .select("id, name, slug, plan, stripe_status")
            .single();

        if (error) throw error;

        return res.status(200).json({ success: true, account: data });
    } catch (err) {
        console.error("Account update error:", err);
        const message = err instanceof Error ? err.message : "Server error";
        return res.status(500).json({ error: message });
    }
}
