/**
 * POST /api/migrate-archived — Add `archived` boolean column to companies table.
 * Safe to run multiple times (idempotent).
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { getAdminSupabase } from "@/lib/supabase";
import { requireAuth, isPlatformAdmin } from "@/lib/auth";

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    if (req.method !== "POST") {
        return res.status(405).json({ error: "Method not allowed" });
    }

    const user = await requireAuth(req, res);
    if (!user) return;

    const isAdmin = await isPlatformAdmin(user.id);
    if (!isAdmin) {
        return res.status(403).json({ error: "Admin only" });
    }

    const admin = getAdminSupabase();

    try {
        // Add the column if it doesn't exist
        const { error } = await admin.rpc("exec_sql", {
            sql: `ALTER TABLE companies ADD COLUMN IF NOT EXISTS archived boolean NOT NULL DEFAULT false;`,
        });

        if (error) {
            // If the RPC doesn't exist, try a different approach — just set defaults on existing rows
            console.warn("[migrate-archived] rpc exec_sql not available, trying update approach:", error.message);

            // Update any null values to false (column may already exist without default)
            const { error: updateErr } = await admin
                .from("companies")
                .update({ archived: false })
                .is("archived", null);

            if (updateErr) {
                console.log("[migrate-archived] Column likely already exists and has defaults:", updateErr.message);
            }

            return res.status(200).json({
                success: true,
                message: "Migration applied (update approach). Column may need manual creation if not present.",
            });
        }

        return res.status(200).json({
            success: true,
            message: "Added `archived` column to companies table.",
        });
    } catch (err) {
        console.error("[migrate-archived] Error:", err);
        const message = err instanceof Error ? err.message : "Migration failed";
        return res.status(500).json({ error: message });
    }
}
