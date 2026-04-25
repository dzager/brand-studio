-- ============================================================
-- Multi-Tenancy Migration — Accounts, Members, Usage, Invitations
-- Run this in your Supabase SQL Editor.
-- IMPORTANT: Back up your database before running.
-- ============================================================

-- 1. accounts (the tenant — each paying customer)
CREATE TABLE IF NOT EXISTS accounts (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                   TEXT NOT NULL,
  slug                   TEXT UNIQUE NOT NULL,
  plan                   TEXT DEFAULT 'starter'
                         CHECK (plan IN ('starter', 'standard', 'scale')),
  plan_started_at        TIMESTAMPTZ DEFAULT now(),
  stripe_customer_id     TEXT UNIQUE,
  stripe_subscription_id TEXT UNIQUE,
  stripe_status          TEXT DEFAULT 'trialing'
                         CHECK (stripe_status IN ('trialing', 'active', 'past_due', 'cancelled')),
  created_at             TIMESTAMPTZ DEFAULT now()
);

-- 2. account_members (join table: user ↔ account + role)
CREATE TABLE IF NOT EXISTS account_members (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id  UUID REFERENCES accounts(id) ON DELETE CASCADE NOT NULL,
  user_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role        TEXT NOT NULL DEFAULT 'member'
              CHECK (role IN ('admin', 'owner', 'member')),
  invited_by  UUID REFERENCES auth.users(id),
  invited_at  TIMESTAMPTZ DEFAULT now(),
  accepted_at TIMESTAMPTZ,
  UNIQUE(account_id, user_id)
);

-- 3. account_usage (monthly article tracking for billing)
CREATE TABLE IF NOT EXISTS account_usage (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id      UUID REFERENCES accounts(id) ON DELETE CASCADE NOT NULL,
  period_start    DATE NOT NULL,
  articles_used   INT NOT NULL DEFAULT 0,
  articles_limit  INT NOT NULL,
  overage_count   INT NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT now(),
  UNIQUE(account_id, period_start)
);

-- 4. platform_admins (Organic staff with global access)
CREATE TABLE IF NOT EXISTS platform_admins (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE
);

-- 5. invitations (pending invites before user accepts)
CREATE TABLE IF NOT EXISTS invitations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id  UUID REFERENCES accounts(id) ON DELETE CASCADE NOT NULL,
  email       TEXT NOT NULL,
  role        TEXT NOT NULL DEFAULT 'member'
              CHECK (role IN ('owner', 'member')),
  token       TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  invited_by  UUID REFERENCES auth.users(id),
  created_at  TIMESTAMPTZ DEFAULT now(),
  expires_at  TIMESTAMPTZ DEFAULT now() + interval '7 days',
  accepted_at TIMESTAMPTZ
);

-- 6. Add account_id to existing tables
ALTER TABLE companies ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES accounts(id) ON DELETE CASCADE;
ALTER TABLE articles  ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES accounts(id) ON DELETE CASCADE;
ALTER TABLE clusters  ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES accounts(id) ON DELETE CASCADE;

-- 7. Indexes
CREATE INDEX IF NOT EXISTS idx_account_members_user_id    ON account_members(user_id);
CREATE INDEX IF NOT EXISTS idx_account_members_account_id ON account_members(account_id);
CREATE INDEX IF NOT EXISTS idx_account_usage_account_period ON account_usage(account_id, period_start);
CREATE INDEX IF NOT EXISTS idx_companies_account_id ON companies(account_id);
CREATE INDEX IF NOT EXISTS idx_articles_account_id  ON articles(account_id);
CREATE INDEX IF NOT EXISTS idx_clusters_account_id  ON clusters(account_id);
CREATE INDEX IF NOT EXISTS idx_invitations_token    ON invitations(token);
CREATE INDEX IF NOT EXISTS idx_invitations_email    ON invitations(email);

-- 8. Enable RLS on new tables
ALTER TABLE accounts        ENABLE ROW LEVEL SECURITY;
ALTER TABLE account_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE account_usage   ENABLE ROW LEVEL SECURITY;
ALTER TABLE invitations     ENABLE ROW LEVEL SECURITY;

-- 9. RLS Policies

-- accounts: visible to members or platform admins
CREATE POLICY "account_access" ON accounts FOR ALL
USING (
  id IN (SELECT account_id FROM account_members WHERE user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM platform_admins WHERE user_id = auth.uid())
);

-- account_members: visible to fellow members or platform admins
CREATE POLICY "account_members_access" ON account_members FOR ALL
USING (
  account_id IN (SELECT account_id FROM account_members WHERE user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM platform_admins WHERE user_id = auth.uid())
);

-- account_usage: visible to members or platform admins
CREATE POLICY "account_usage_access" ON account_usage FOR ALL
USING (
  account_id IN (SELECT account_id FROM account_members WHERE user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM platform_admins WHERE user_id = auth.uid())
);

-- invitations: visible to members of the account or platform admins
CREATE POLICY "invitations_access" ON invitations FOR ALL
USING (
  account_id IN (SELECT account_id FROM account_members WHERE user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM platform_admins WHERE user_id = auth.uid())
);

-- Drop existing permissive policies on companies/articles/clusters
-- (these are the "Allow all" policies from earlier migrations)
DO $$ BEGIN
  -- companies
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'companies' AND policyname = 'Allow all access to companies') THEN
    DROP POLICY "Allow all access to companies" ON companies;
  END IF;
  -- articles
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'articles' AND policyname = 'Allow all access to articles') THEN
    DROP POLICY "Allow all access to articles" ON articles;
  END IF;
  -- clusters
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'clusters' AND policyname = 'Allow all access to clusters') THEN
    DROP POLICY "Allow all access to clusters" ON clusters;
  END IF;
END $$;

-- companies: scoped to account or platform admin
CREATE POLICY "account_companies" ON companies FOR ALL
USING (
  account_id IN (SELECT account_id FROM account_members WHERE user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM platform_admins WHERE user_id = auth.uid())
  OR account_id IS NULL  -- allow legacy rows during migration
);

-- articles: scoped to account or platform admin
CREATE POLICY "account_articles" ON articles FOR ALL
USING (
  account_id IN (SELECT account_id FROM account_members WHERE user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM platform_admins WHERE user_id = auth.uid())
  OR account_id IS NULL
);

-- clusters: scoped to account or platform admin
CREATE POLICY "account_clusters" ON clusters FOR ALL
USING (
  account_id IN (SELECT account_id FROM account_members WHERE user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM platform_admins WHERE user_id = auth.uid())
  OR account_id IS NULL
);
