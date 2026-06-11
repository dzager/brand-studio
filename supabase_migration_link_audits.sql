-- Link Audits — stores site-wide link health audit results
-- Run this migration against your Supabase database

CREATE TABLE IF NOT EXISTS link_audits (
    id                  uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    account_id          uuid REFERENCES accounts(id) ON DELETE CASCADE,
    company_id          uuid REFERENCES companies(id) ON DELETE SET NULL,
    site_url            text NOT NULL,
    status              text NOT NULL DEFAULT 'running'
                        CHECK (status IN ('running', 'complete', 'failed', 'cancelled')),
    pages_crawled       int DEFAULT 0,
    total_links         int DEFAULT 0,
    broken_links        int DEFAULT 0,
    redirects_found     int DEFAULT 0,
    orphan_pages        int DEFAULT 0,
    opportunities_found int DEFAULT 0,
    overall_score       int DEFAULT 100,
    report              jsonb,
    error               text,
    created_at          timestamptz DEFAULT now(),
    completed_at        timestamptz
);

-- Index for listing audits by account
CREATE INDEX IF NOT EXISTS idx_link_audits_account
    ON link_audits(account_id, created_at DESC);

-- Index for listing audits by company
CREATE INDEX IF NOT EXISTS idx_link_audits_company
    ON link_audits(company_id, created_at DESC);

-- RLS: account members can see their own audits
ALTER TABLE link_audits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Account members can view link audits"
    ON link_audits FOR SELECT
    USING (
        account_id IN (
            SELECT account_id FROM account_members
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Account members can insert link audits"
    ON link_audits FOR INSERT
    WITH CHECK (
        account_id IN (
            SELECT account_id FROM account_members
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Account members can update link audits"
    ON link_audits FOR UPDATE
    USING (
        account_id IN (
            SELECT account_id FROM account_members
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Account members can delete link audits"
    ON link_audits FOR DELETE
    USING (
        account_id IN (
            SELECT account_id FROM account_members
            WHERE user_id = auth.uid()
        )
    );
