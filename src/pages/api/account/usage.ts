/**
 * GET /api/account/usage — Returns current period usage for the authenticated user's account
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { requireAuth, getUserAccounts, isPlatformAdmin } from "@/lib/auth";
import { getAccountUsageSummary } from "@/lib/usage";

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    if (req.method !== "GET") {
        return res.status(405).json({ error: "Method not allowed" });
    }

    const user = await requireAuth(req, res);
    if (!user) return;

    const accountId = req.query.account_id as string;
    if (!accountId) {
        return res.status(400).json({ error: "account_id is required" });
    }

    // Verify access
    const accounts = await getUserAccounts(user.id);
    const isAdmin = await isPlatformAdmin(user.id);
    const hasAccess =
        isAdmin || accounts.some((a) => a.account_id === accountId);

    if (!hasAccess) {
        return res.status(403).json({ error: "Access denied" });
    }

    try {
        const summary = await getAccountUsageSummary(accountId);
        return res.status(200).json(summary);
    } catch (err) {
        console.error("Usage API error:", err);
        const message = err instanceof Error ? err.message : "Server error";
        return res.status(500).json({ error: message });
    }
}
