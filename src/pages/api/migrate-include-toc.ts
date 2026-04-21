import type { NextApiRequest, NextApiResponse } from "next";
import { getSupabase } from "@/lib/supabase";

/**
 * One-time migration endpoint to add include_toc column.
 * POST /api/migrate-include-toc
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

        // Check if column exists by trying to read it
        const { data: testData, error: testErr } = await supabase
            .from("companies")
            .select("id, include_toc")
            .limit(1);

        if (testErr && testErr.message.includes("include_toc")) {
            // Column doesn't exist — return SQL instructions
            return res.status(200).json({
                status: "column_missing",
                message: "The include_toc column needs to be added. Run this SQL in the Supabase SQL editor:",
                sql: "ALTER TABLE companies ADD COLUMN IF NOT EXISTS include_toc boolean DEFAULT false; UPDATE companies SET include_toc = false WHERE include_toc IS NULL;",
            });
        }

        // Column exists — set default for any nulls
        const { error: updateErr } = await supabase
            .from("companies")
            .update({ include_toc: false })
            .is("include_toc", null);

        if (updateErr) {
            console.warn("Update null include_toc:", updateErr.message);
        }

        return res.status(200).json({
            status: "ok",
            message: "include_toc column exists and defaults are set.",
            sample: testData,
        });
    } catch (err) {
        console.error("Migration error:", err);
        const message = err instanceof Error ? err.message : "Unknown error";
        return res.status(500).json({ error: message });
    }
}
