/**
 * GET /api/auth/me
 *
 * Returns the current user's profile, account memberships, and platform
 * admin status.  Uses the server-side Supabase client (cookie-based session)
 * and the service-role admin client for admin lookups — so it is never
 * affected by client-side RLS timing issues.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { getCurrentUser, getUserAccounts, isPlatformAdmin } from "@/lib/auth";

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    if (req.method !== "GET") {
        return res.status(405).json({ error: "Method not allowed" });
    }

    const user = await getCurrentUser(req, res);
    if (!user) {
        return res.status(401).json({ error: "Not authenticated" });
    }

    const [accounts, isAdmin] = await Promise.all([
        getUserAccounts(user.id),
        isPlatformAdmin(user.id),
    ]);

    return res.status(200).json({
        user: { id: user.id, email: user.email },
        accounts,
        isAdmin,
    });
}
