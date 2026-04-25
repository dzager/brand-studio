-- Assign hellozager@gmail.com to the "Boundless" company
-- Run this in the Supabase SQL Editor

-- Step 1: Ensure the company_id column exists (idempotent)
ALTER TABLE account_members
  ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE SET NULL;

-- Step 2: Assign the member to the Boundless company
UPDATE account_members
SET company_id = (
  SELECT id FROM companies WHERE LOWER(name) = 'boundless' LIMIT 1
)
WHERE user_id = (
  SELECT id FROM auth.users WHERE email = 'hellozager@gmail.com' LIMIT 1
);

-- Step 3: Verify
SELECT
  am.id,
  au.email,
  am.role,
  am.company_id,
  c.name AS company_name
FROM account_members am
JOIN auth.users au ON au.id = am.user_id
LEFT JOIN companies c ON c.id = am.company_id
WHERE au.email = 'hellozager@gmail.com';
