/**
 * Freshness Report API
 *
 * GET /api/freshness-report?id=<audit_id> — Get full audit report
 * DELETE /api/freshness-report?id=<audit_id> — Delete an audit
 */

import type { NextApiRequest, NextApiResponse } from "next";
import { getSupabase } from "@/lib/supabase";
import { requireAuth } from "@/lib/auth";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    const authUser = await requireAuth(req, res);
    if (!authUser) return;

    const { id } = req.query;
    if (!id || typeof id !== "string") {
        return res.status(400).json({ error: "Audit ID is required" });
    }

    const sb = getSupabase();

    if (req.method === "GET") {
        const { data, error } = await sb
            .from("freshness_audits")
            .select("*")
            .eq("id", id)
            .single();

        if (error) return res.status(404).json({ error: "Audit not found" });
        return res.status(200).json(data);
    }

    if (req.method === "DELETE") {
        const { error } = await sb.from("freshness_audits").delete().eq("id", id);
        if (error) return res.status(500).json({ error: error.message });
        return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: "Method not allowed" });
}
