-- Add prompt engine override columns to the accounts table.
-- These allow account-level customization of the base system prompt and user prompt template.
-- Company-level editorial guidelines, SEO guidelines, and voice profiles still take priority.

ALTER TABLE accounts
    ADD COLUMN IF NOT EXISTS base_system_prompt TEXT DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS base_user_prompt TEXT DEFAULT NULL;

COMMENT ON COLUMN accounts.base_system_prompt IS 'Account-level override for the base blog system prompt. When set, replaces the hardcoded default. Company-level guidelines are still appended on top.';
COMMENT ON COLUMN accounts.base_user_prompt IS 'Account-level override for the base user prompt template. When set, replaces the hardcoded default.';
