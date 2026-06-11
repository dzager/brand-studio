-- Crawl Cache — short-lived cache for DeepCrawlResult objects
-- Prevents duplicate crawls when running freshness + link audits on the same site.
-- Run this migration against your Supabase database.

CREATE TABLE IF NOT EXISTS crawl_cache (
    id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    account_id      uuid REFERENCES accounts(id) ON DELETE CASCADE,
    site_url        text NOT NULL,
    scope           text NOT NULL DEFAULT 'deep',
    result          jsonb NOT NULL,
    pages_crawled   int DEFAULT 0,
    created_at      timestamptz DEFAULT now(),
    expires_at      timestamptz DEFAULT (now() + interval '15 minutes')
);

-- Fast lookup by account + URL + scope, filtering by expiry
CREATE INDEX IF NOT EXISTS idx_crawl_cache_lookup
    ON crawl_cache(account_id, site_url, scope, expires_at DESC);

-- RLS: account members can manage their own cache entries
ALTER TABLE crawl_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Account members can view crawl cache"
    ON crawl_cache FOR SELECT
    USING (
        account_id IN (
            SELECT account_id FROM account_members
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Account members can insert crawl cache"
    ON crawl_cache FOR INSERT
    WITH CHECK (
        account_id IN (
            SELECT account_id FROM account_members
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Account members can update crawl cache"
    ON crawl_cache FOR UPDATE
    USING (
        account_id IN (
            SELECT account_id FROM account_members
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Account members can delete crawl cache"
    ON crawl_cache FOR DELETE
    USING (
        account_id IN (
            SELECT account_id FROM account_members
            WHERE user_id = auth.uid()
        )
    );
