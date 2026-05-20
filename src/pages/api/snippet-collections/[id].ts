/**
 * GET    /api/snippet-collections/[id] — Fetch a single collection
 * PUT    /api/snippet-collections/[id] — Update (rename or replace snippets)
 * DELETE /api/snippet-collections/[id] — Delete a collection
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { getSupabase } from "@/lib/supabase";
import { requireAuth } from "@/lib/auth";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    const authUser = await requireAuth(req, res);
    if (!authUser) return;

    const { id } = req.query;
    if (!id || typeof id !== "string") {
        return res.status(400).json({ error: "Collection ID is required" });
    }

    const sb = getSupabase();

    if (req.method === "GET") {
        const { data, error } = await sb
            .from("snippet_collections")
            .select("*")
            .eq("id", id)
            .single();

        if (error || !data) return res.status(404).json({ error: "Collection not found" });
        return res.status(200).json({
            ...data,
            snippet_count: Array.isArray(data.snippets) ? data.snippets.length : 0,
        });
    }

    if (req.method === "PUT") {
        const { name, snippets } = req.body ?? {};
        const updates: Record<string, unknown> = {
            updated_at: new Date().toISOString(),
        };
        if (typeof name === "string" && name.trim()) updates.name = name.trim();
        if (Array.isArray(snippets)) updates.snippets = snippets;

        const { data, error } = await sb
            .from("snippet_collections")
            .update(updates)
            .eq("id", id)
            .select("id, name, company_id, snippets, created_at, updated_at")
            .single();

        if (error) return res.status(500).json({ error: error.message });
        return res.status(200).json({
            ...data,
            snippet_count: Array.isArray(data?.snippets) ? data.snippets.length : 0,
        });
    }

    if (req.method === "DELETE") {
        const { error } = await sb
            .from("snippet_collections")
            .delete()
            .eq("id", id);

        if (error) return res.status(500).json({ error: error.message });
        return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: "Method not allowed" });
}
