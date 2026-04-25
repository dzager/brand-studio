-- Migration: Add company_id scoping to account_members
-- When company_id IS NOT NULL, the member can only access that specific company's content.
-- When company_id IS NULL (owners/admins), the member can access ALL companies in the account.

-- 1. Add optional company_id to account_members
ALTER TABLE account_members
  ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE SET NULL;

-- 2. Index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_account_members_company_id ON account_members(company_id);
