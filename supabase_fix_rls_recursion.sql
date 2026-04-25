-- ============================================================
-- Fix: Infinite RLS recursion on account_members
--
-- Problem: The RLS policy on account_members references itself
-- via `SELECT account_id FROM account_members WHERE ...`, which
-- causes PostgreSQL to evaluate the same policy recursively.
--
-- Solution: Create SECURITY DEFINER helper functions that bypass
-- RLS to look up user data, then rewrite all policies to use
-- those functions instead of direct subqueries on protected tables.
--
-- NOTE: Functions go in "public" schema because Supabase SQL
-- editor doesn't have CREATE permission on the "auth" schema.
-- ============================================================

-- 1. Helper function: get the authenticated user's account IDs
--    SECURITY DEFINER runs as the function owner (postgres), bypassing RLS.
CREATE OR REPLACE FUNCTION public.user_account_ids()
RETURNS SETOF UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT account_id
  FROM public.account_members
  WHERE user_id = auth.uid();
$$;

-- 2. Helper function: check if the authenticated user is a platform admin
CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.platform_admins WHERE user_id = auth.uid()
  );
$$;


-- 3. Drop ALL existing policies that cause the recursion

DROP POLICY IF EXISTS "account_members_access" ON account_members;
DROP POLICY IF EXISTS "account_access" ON accounts;
DROP POLICY IF EXISTS "account_usage_access" ON account_usage;
DROP POLICY IF EXISTS "invitations_access" ON invitations;
DROP POLICY IF EXISTS "account_companies" ON companies;
DROP POLICY IF EXISTS "account_articles" ON articles;
DROP POLICY IF EXISTS "account_clusters" ON clusters;


-- 4. Recreate policies using the helper functions (no recursion)

CREATE POLICY "account_members_access" ON account_members FOR ALL
USING (
  account_id IN (SELECT public.user_account_ids())
  OR public.is_platform_admin()
);

CREATE POLICY "account_access" ON accounts FOR ALL
USING (
  id IN (SELECT public.user_account_ids())
  OR public.is_platform_admin()
);

CREATE POLICY "account_usage_access" ON account_usage FOR ALL
USING (
  account_id IN (SELECT public.user_account_ids())
  OR public.is_platform_admin()
);

CREATE POLICY "invitations_access" ON invitations FOR ALL
USING (
  account_id IN (SELECT public.user_account_ids())
  OR public.is_platform_admin()
);

CREATE POLICY "account_companies" ON companies FOR ALL
USING (
  account_id IN (SELECT public.user_account_ids())
  OR public.is_platform_admin()
  OR account_id IS NULL
);

CREATE POLICY "account_articles" ON articles FOR ALL
USING (
  account_id IN (SELECT public.user_account_ids())
  OR public.is_platform_admin()
  OR account_id IS NULL
);

CREATE POLICY "account_clusters" ON clusters FOR ALL
USING (
  account_id IN (SELECT public.user_account_ids())
  OR public.is_platform_admin()
  OR account_id IS NULL
);

-- 5. RLS for platform_admins table
ALTER TABLE platform_admins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "platform_admins_read" ON platform_admins;
DROP POLICY IF EXISTS "platform_admins_policy" ON platform_admins;
CREATE POLICY "platform_admins_read" ON platform_admins FOR SELECT
USING (
  user_id = auth.uid()
);
