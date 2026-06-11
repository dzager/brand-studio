-- Add pages_discovered column to freshness_audits
-- Tracks how many URLs were discovered during crawl (vs. how many were actually crawled)
-- This enables the "continue crawling" feature

ALTER TABLE freshness_audits
    ADD COLUMN IF NOT EXISTS pages_discovered int DEFAULT 0;
