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

    // Determine if this user is scoped to specific companies
    let scopedCompanyIds: string[] = [];
    let accountIds: string[] = [];
    const isAdmin = await isPlatformAdmin(user.id);
    if (!isAdmin) {
        const accounts = await getUserAccounts(user.id);
        scopedCompanyIds = accounts
            .filter((a) => a.company_id)
            .map((a) => a.company_id!);
        accountIds = accounts.map((a) => a.account_id);
    }

    try {
        if (req.method === "GET") {
            const { id: qId, full } = req.query;

            // If requesting a specific article with full content
            if (typeof qId === "string" && qId) {
                let query = admin.from("articles").select("*").eq("id", qId);
                if (scopedCompanyIds.length > 0) {
                    query = query.in("company_id", scopedCompanyIds);
                } else if (!isAdmin && accountIds.length > 0) {
                    query = query.in("account_id", accountIds);
                }
                const { data, error } = await query.single();
                if (error) throw error;
                return res.status(200).json(data);
            }

            // List mode: exclude heavy columns (image_base64, html) to avoid Supabase timeout.
            let listQuery = admin
                .from("articles")
                .select("id,title,slug,excerpt,image_prompt,seo,outline,model_used,image_style,company_id,cluster_id,cluster_role,humanized,created_at,updated_at")
                .order("created_at", { ascending: false });

            if (scopedCompanyIds.length > 0) {
                listQuery = listQuery.in("company_id", scopedCompanyIds);
            } else if (!isAdmin && accountIds.length > 0) {
                listQuery = listQuery.in("account_id", accountIds);
            }

            const { data, error } = await listQuery;
            if (error) throw error;
            return res.status(200).json(data);
        }

        if (req.method === "POST") {
            const {
                title,
                slug,
                excerpt,
                html,
                image_base64,
                image_prompt,
                seo,
                outline,
                model_used,
                image_style,
                company_id,
                account_id,
                cluster_id,
                cluster_role,
            } = req.body;

            // Determine account_id
            let targetAccountId = account_id;
            if (!targetAccountId) {
                // If company_id provided, look up the company's account
                if (company_id) {
                    const { data: company } = await admin
                        .from("companies")
                        .select("account_id")
                        .eq("id", company_id)
                        .single();
                    targetAccountId = company?.account_id || null;
                }

                // Fall back to user's first account
                if (!targetAccountId) {
                    const accounts = await getUserAccounts(user.id);
                    targetAccountId = accounts[0]?.account_id || null;
                }
            }

            const { data, error } = await admin
                .from("articles")
                .insert({
                    title,
                    slug,
                    excerpt,
                    html,
                    image_base64,
                    image_prompt,
                    seo,
                    outline,
                    model_used,
                    image_style,
                    company_id: company_id || null,
                    account_id: targetAccountId,
                    cluster_id: cluster_id || null,
                    cluster_role: cluster_role || null,
                })
                .select()
                .single();

            if (error) throw error;
            return res.status(201).json(data);
        }

        return res.status(405).json({ error: "Method not allowed" });
    } catch (err: any) {
        console.error("API /api/articles error:", err);
        const message = err?.message || (typeof err === "string" ? err : JSON.stringify(err));
        return res.status(500).json({ error: message });
    }
}
