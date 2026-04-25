/**
 * GET /api/account/company — Returns the company linked to the current member's account.
 *
 * Query params:
 *   ?account_id=xxx  (optional — uses first account if omitted)
 *
 * Returns the full company record including image_style_categories,
 * voice_profile, editorial_guidelines, and prompt templates.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { getAdminSupabase } from "@/lib/supabase";
import { requireAuth, getUserAccounts, isPlatformAdmin } from "@/lib/auth";

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    if (req.method !== "GET") {
        return res.status(405).json({ error: "Method not allowed" });
    }

    const user = await requireAuth(req, res);
    if (!user) return;

    const admin = getAdminSupabase();

    try {
        const accounts = await getUserAccounts(user.id);
        const isAdmin = await isPlatformAdmin(user.id);

        // Determine which account to use
        const accountId = req.query.account_id as string | undefined;
        const account = accountId
            ? accounts.find((a) => a.account_id === accountId)
            : accounts[0];

        if (!account && !isAdmin) {
            return res.status(404).json({ error: "No account found" });
        }

        // For scoped members, use their company_id directly
        const companyId = account?.company_id;

        if (!companyId) {
            // Non-scoped users (owners/admins) — return all companies for this account
            const targetAccountId = account?.account_id || accountId;
            if (!targetAccountId) {
                return res.status(404).json({ error: "No account found" });
            }

            const { data: companies, error } = await admin
                .from("companies")
                .select("*")
                .eq("account_id", targetAccountId)
                .order("name", { ascending: true });

            if (error) throw error;

            // Also fetch prompts for each company
            const companyIds = (companies || []).map((c: any) => c.id);
            let prompts: any[] = [];
            if (companyIds.length > 0) {
                const { data: promptData } = await admin
                    .from("company_prompts")
                    .select("*")
                    .in("company_id", companyIds)
                    .order("created_at", { ascending: false });
                prompts = promptData || [];
            }

            return res.status(200).json({
                mode: "multi",
                companies: (companies || []).map((c: any) => ({
                    ...c,
                    prompts: prompts.filter((p: any) => p.company_id === c.id),
                })),
            });
        }

        // Single company — fetch it
        const { data: company, error } = await admin
            .from("companies")
            .select("*")
            .eq("id", companyId)
            .single();

        if (error) throw error;
        if (!company) {
            return res.status(404).json({ error: "Company not found" });
        }

        // Fetch prompts for this company
        const { data: prompts } = await admin
            .from("company_prompts")
            .select("*")
            .eq("company_id", companyId)
            .order("created_at", { ascending: false });

        return res.status(200).json({
            mode: "single",
            company: {
                ...company,
                prompts: prompts || [],
            },
        });
    } catch (err) {
        console.error("Account company API error:", err);
        const message = err instanceof Error ? err.message : "Server error";
        return res.status(500).json({ error: message });
    }
}
