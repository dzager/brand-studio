import type { NextApiRequest, NextApiResponse } from "next";
import { getSupabase } from "@/lib/supabase";

/**
 * One-time migration endpoint to add auto_humanize column.
 * POST /api/migrate-auto-humanize
 * Safe to run multiple times — uses IF NOT EXISTS.
 */
export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    if (req.method !== "POST") {
        return res.status(405).json({ error: "Method not allowed. Use POST." });
    }

    try {
        const supabase = getSupabase();

        // Try to add the column — if it already exists, this will fail gracefully
        // We'll try reading it first to check
        const { data: testData, error: testErr } = await supabase
            .from("companies")
            .select("id, auto_humanize")
            .limit(1);

        if (testErr && testErr.message.includes("auto_humanize")) {
            // Column doesn't exist — we need to create it via raw SQL
            // Since we can't run DDL through the API, we'll use a workaround:
            // Just return instructions
            return res.status(200).json({
                status: "column_missing",
                message: "The auto_humanize column needs to be added. Run this SQL in the Supabase SQL editor:",
                sql: "ALTER TABLE companies ADD COLUMN IF NOT EXISTS auto_humanize boolean DEFAULT true; UPDATE companies SET auto_humanize = true WHERE auto_humanize IS NULL;",
            });
        }

        // Column exists — set default for any nulls
        const { error: updateErr } = await supabase
            .from("companies")
            .update({ auto_humanize: true })
            .is("auto_humanize", null);

        if (updateErr) {
            console.warn("Update null auto_humanize:", updateErr.message);
        }

        return res.status(200).json({
            status: "ok",
            message: "auto_humanize column exists and defaults are set.",
            sample: testData,
        });
    } catch (err) {
        console.error("Migration error:", err);
        const message = err instanceof Error ? err.message : "Unknown error";
        return res.status(500).json({ error: message });
    }
}
