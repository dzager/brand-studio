/**
 * POST /api/snippet-collections/[id]/add-snippet — Add a snippet to a collection
 *
 * Body: { text, note?, source_url?, source_title?, research_project_id?, color? }
 *
 * Appends to the collection's snippets array without requiring the full array.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { getSupabase } from "@/lib/supabase";
import { requireAuth } from "@/lib/auth";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    const authUser = await requireAuth(req, res);
    if (!authUser) return;

    if (req.method !== "POST") {
        return res.status(405).json({ error: "Method not allowed" });
    }

    const { id } = req.query;
    if (!id || typeof id !== "string") {
        return res.status(400).json({ error: "Collection ID is required" });
    }

    const { text, note, source_url, source_title, research_project_id, color } = req.body ?? {};

    if (!text || typeof text !== "string" || text.trim().length < 3) {
        return res.status(400).json({ error: "text is required (min 3 chars)" });
    }

    const sb = getSupabase();

    // Fetch current collection
    const { data: collection, error: fetchErr } = await sb
        .from("snippet_collections")
        .select("id, snippets")
        .eq("id", id)
        .single();

    if (fetchErr || !collection) {
        return res.status(404).json({ error: "Collection not found" });
    }

    const currentSnippets = Array.isArray(collection.snippets) ? collection.snippets : [];

    const newSnippet: Record<string, unknown> = {
        id: crypto.randomUUID(),
        text: text.trim(),
        added_at: new Date().toISOString(),
    };
    if (note) newSnippet.note = note;
    if (source_url) newSnippet.source_url = source_url;
    if (source_title) newSnippet.source_title = source_title;
    if (research_project_id) newSnippet.research_project_id = research_project_id;
    if (color) newSnippet.color = color;

    const updatedSnippets = [...currentSnippets, newSnippet];

    const { data, error } = await sb
        .from("snippet_collections")
        .update({
            snippets: updatedSnippets,
            updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .select("id, name, snippets")
        .single();

    if (error) return res.status(500).json({ error: error.message });

    return res.status(200).json({
        ...data,
        snippet_count: Array.isArray(data?.snippets) ? data.snippets.length : 0,
    });
}
