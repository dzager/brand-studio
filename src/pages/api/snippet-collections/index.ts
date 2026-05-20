/**
 * GET  /api/snippet-collections        — List collections (filtered by account, optional company_id)
 * POST /api/snippet-collections        — Create a new collection
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { getSupabase } from "@/lib/supabase";
import { requireAuth, getUserAccounts } from "@/lib/auth";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    const authUser = await requireAuth(req, res);
    if (!authUser) return;

    const accounts = await getUserAccounts(authUser.id);
    const accountIds = accounts.map((a) => a.account_id);

    if (req.method === "GET") {
        return handleList(req, res, accountIds);
    }
    if (req.method === "POST") {
        return handleCreate(req, res, accounts);
    }
    return res.status(405).json({ error: "Method not allowed" });
}

// ── List ─────────────────────────────────────────────────────────────────

async function handleList(
    req: NextApiRequest,
    res: NextApiResponse,
    accountIds: string[]
) {
    const { company_id } = req.query;
    const sb = getSupabase();

    let query = sb
        .from("snippet_collections")
        .select("id, name, company_id, snippets, created_at, updated_at")
        .in("account_id", accountIds)
        .order("updated_at", { ascending: false });

    if (typeof company_id === "string" && company_id) {
        query = query.eq("company_id", company_id);
    }

    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });

    // Enrich with snippet count
    const enriched = (data ?? []).map((c: any) => ({
        ...c,
        snippet_count: Array.isArray(c.snippets) ? c.snippets.length : 0,
    }));

    return res.status(200).json(enriched);
}

// ── Create ───────────────────────────────────────────────────────────────

async function handleCreate(
    req: NextApiRequest,
    res: NextApiResponse,
    accounts: { account_id: string; role: string; company_id?: string | null }[]
) {
    const { name, company_id } = req.body ?? {};

    if (!name || typeof name !== "string" || name.trim().length < 1) {
        return res.status(400).json({ error: "name is required" });
    }
    if (!company_id || typeof company_id !== "string") {
        return res.status(400).json({ error: "company_id is required" });
    }

    const sb = getSupabase();

    // Determine account_id from company
    const { data: companyData } = await sb
        .from("companies")
        .select("account_id")
        .eq("id", company_id)
        .single();

    const accountId = companyData?.account_id || accounts[0]?.account_id;
    if (!accountId) {
        return res.status(400).json({ error: "Could not determine account" });
    }

    const { data, error } = await sb
        .from("snippet_collections")
        .insert({
            name: name.trim(),
            company_id,
            account_id: accountId,
            snippets: [],
        })
        .select("id, name, company_id, snippets, created_at")
        .single();

    if (error) return res.status(500).json({ error: error.message });
    return res.status(201).json({ ...data, snippet_count: 0 });
}
