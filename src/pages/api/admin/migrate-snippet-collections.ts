/**
 * POST /api/admin/migrate-snippet-collections — One-time migration endpoint
 * Creates the snippet_collections table.
 * Delete this file after running.
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

    const sb = getSupabase();

    // Test if table already exists
    const { error: testErr } = await sb.from("snippet_collections").select("id").limit(1);
    if (!testErr) {
        return res.status(200).json({ message: "Table already exists — no migration needed." });
    }

    return res.status(200).json({
        message: "Table does not exist yet. Please run this SQL in your Supabase SQL Editor:",
        sql: `
-- Snippet Collections Table Migration
create table if not exists snippet_collections (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  company_id uuid references companies(id) on delete cascade,
  account_id uuid references accounts(id) on delete cascade,
  snippets jsonb default '[]',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_snippet_collections_company on snippet_collections(company_id);
create index if not exists idx_snippet_collections_account on snippet_collections(account_id);
        `.trim(),
    });
}
