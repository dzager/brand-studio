-- Research Hub: research_projects + research_sources tables
-- Run this migration in the Supabase SQL editor

-- ── research_projects ────────────────────────────────────────────
create table if not exists research_projects (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references companies(id) on delete cascade,
  account_id uuid references accounts(id) on delete cascade,
  title text not null,
  status text not null default 'pending',  -- pending | researching | complete | failed
  query text not null,
  analysis jsonb,                          -- AI-generated structured analysis
  brief jsonb,                             -- compiled research brief from highlights
  suggested_queries jsonb default '[]',    -- follow-up query suggestions
  parent_id uuid references research_projects(id) on delete set null,  -- for follow-up chains
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_research_projects_company on research_projects(company_id);
create index if not exists idx_research_projects_account on research_projects(account_id);
create index if not exists idx_research_projects_parent  on research_projects(parent_id);

-- ── research_sources ─────────────────────────────────────────────
create table if not exists research_sources (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references research_projects(id) on delete cascade,
  url text not null,
  title text,
  domain text,
  content_text text,                       -- extracted article text
  summary text,                            -- AI-generated summary of this source
  relevance_score float default 0,         -- 0-1 relevance to the query
  highlights jsonb default '[]',           -- user-curated highlights [{text, note, color}]
  crawled_at timestamptz default now()
);

create index if not exists idx_research_sources_project on research_sources(project_id);

-- ── RLS policies (service_role bypasses, but good practice) ──────
alter table research_projects enable row level security;
alter table research_sources  enable row level security;

-- Allow authenticated users to read their own projects
create policy "Users can view own research"
  on research_projects for select
  using (account_id in (
    select account_id from account_members where user_id = auth.uid()
  ));

create policy "Users can insert own research"
  on research_projects for insert
  with check (account_id in (
    select account_id from account_members where user_id = auth.uid()
  ));

create policy "Users can update own research"
  on research_projects for update
  using (account_id in (
    select account_id from account_members where user_id = auth.uid()
  ));

create policy "Users can delete own research"
  on research_projects for delete
  using (account_id in (
    select account_id from account_members where user_id = auth.uid()
  ));

-- Sources inherit access from their project
create policy "Users can view research sources"
  on research_sources for select
  using (project_id in (
    select id from research_projects where account_id in (
      select account_id from account_members where user_id = auth.uid()
    )
  ));

create policy "Users can manage research sources"
  on research_sources for all
  using (project_id in (
    select id from research_projects where account_id in (
      select account_id from account_members where user_id = auth.uid()
    )
  ));
