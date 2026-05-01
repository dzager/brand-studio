-- Add voice_profile column to companies table
-- Stores the structured voice profile (JSON) used by the brand engine
ALTER TABLE companies ADD COLUMN IF NOT EXISTS voice_profile jsonb DEFAULT NULL;

-- Add include_toc column if missing (used for table-of-contents toggle)
ALTER TABLE companies ADD COLUMN IF NOT EXISTS include_toc boolean DEFAULT false;
