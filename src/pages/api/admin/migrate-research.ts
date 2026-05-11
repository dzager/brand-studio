/**
 * POST /api/admin/migrate-research — One-time migration endpoint
 * Creates research_projects and research_sources tables.
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

    // Test if tables already exist
    const { error: testErr } = await sb.from("research_projects").select("id").limit(1);
    if (!testErr) {
        return res.status(200).json({ message: "Tables already exist — no migration needed." });
    }

    // Tables don't exist — we need to create them via raw SQL
    // Since Supabase JS client doesn't support DDL, return the SQL for the user to run
    return res.status(200).json({
        message: "Tables do not exist yet. Please run this SQL in your Supabase SQL Editor (supabase.com/dashboard → SQL Editor → New Query):",
        sql: `
-- Research Hub Tables Migration
create table if not exists research_projects (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references companies(id) on delete cascade,
  account_id uuid references accounts(id) on delete cascade,
  title text not null,
  status text not null default 'pending',
  query text not null,
  analysis jsonb,
  brief jsonb,
  suggested_queries jsonb default '[]',
  parent_id uuid references research_projects(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_research_projects_company on research_projects(company_id);
create index if not exists idx_research_projects_account on research_projects(account_id);
create index if not exists idx_research_projects_parent on research_projects(parent_id);

create table if not exists research_sources (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references research_projects(id) on delete cascade,
  url text not null,
  title text,
  domain text,
  content_text text,
  summary text,
  relevance_score float default 0,
  highlights jsonb default '[]',
  crawled_at timestamptz default now()
);

create index if not exists idx_research_sources_project on research_sources(project_id);
        `.trim(),
    });
}
