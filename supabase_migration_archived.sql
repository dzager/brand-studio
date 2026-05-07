-- Add archived column to companies table for soft-archiving projects
-- Safe to run multiple times (IF NOT EXISTS)

ALTER TABLE companies
    ADD COLUMN IF NOT EXISTS archived boolean NOT NULL DEFAULT false;

-- Optional: index for efficient filtered queries
CREATE INDEX IF NOT EXISTS idx_companies_archived
    ON companies (archived)
    WHERE archived = true;
