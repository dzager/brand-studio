-- Freshness Audits — stores site-wide fact freshness audit results
-- Run this migration against your Supabase database

CREATE TABLE IF NOT EXISTS freshness_audits (
    id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    account_id  uuid REFERENCES accounts(id) ON DELETE CASCADE,
    company_id  uuid REFERENCES companies(id) ON DELETE SET NULL,
    site_url    text NOT NULL,
    status      text NOT NULL DEFAULT 'running'
                CHECK (status IN ('running', 'complete', 'failed')),
    pages_crawled   int DEFAULT 0,
    total_facts     int DEFAULT 0,
    issues_found    int DEFAULT 0,
    critical_issues int DEFAULT 0,
    overall_health  int DEFAULT 100,
    report      jsonb,
    error       text,
    created_at  timestamptz DEFAULT now(),
    completed_at timestamptz
);

-- Index for listing audits by account
CREATE INDEX IF NOT EXISTS idx_freshness_audits_account
    ON freshness_audits(account_id, created_at DESC);

-- Index for listing audits by company
CREATE INDEX IF NOT EXISTS idx_freshness_audits_company
    ON freshness_audits(company_id, created_at DESC);

-- RLS: account members can see their own audits
ALTER TABLE freshness_audits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Account members can view audits"
    ON freshness_audits FOR SELECT
    USING (
        account_id IN (
            SELECT account_id FROM account_members
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Account members can insert audits"
    ON freshness_audits FOR INSERT
    WITH CHECK (
        account_id IN (
            SELECT account_id FROM account_members
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Account members can update audits"
    ON freshness_audits FOR UPDATE
    USING (
        account_id IN (
            SELECT account_id FROM account_members
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Account members can delete audits"
    ON freshness_audits FOR DELETE
    USING (
        account_id IN (
            SELECT account_id FROM account_members
            WHERE user_id = auth.uid()
        )
    );
