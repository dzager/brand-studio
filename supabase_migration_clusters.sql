-- Topical Cluster System — Supabase Migration
-- Run this in your Supabase SQL Editor

-- 1. Create clusters table
CREATE TABLE IF NOT EXISTS clusters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    pillar_topic TEXT NOT NULL,
    strategy JSONB NOT NULL DEFAULT '{}',
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'in_progress', 'complete')),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Add cluster columns to articles
ALTER TABLE articles ADD COLUMN IF NOT EXISTS cluster_id UUID REFERENCES clusters(id) ON DELETE SET NULL;
ALTER TABLE articles ADD COLUMN IF NOT EXISTS cluster_role TEXT CHECK (cluster_role IN ('pillar', 'supporting', 'long_tail'));

-- 3. Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_clusters_company_id ON clusters(company_id);
CREATE INDEX IF NOT EXISTS idx_articles_cluster_id ON articles(cluster_id);

-- 4. Enable RLS (match your existing policy pattern)
ALTER TABLE clusters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to clusters" ON clusters FOR ALL USING (true) WITH CHECK (true);
