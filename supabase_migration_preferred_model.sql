-- Migration: Add preferred_model column to companies table
-- This stores the AI model ID selected via the Model Bake-off feature.
-- Each company can have a different preferred writing model.

ALTER TABLE companies
ADD COLUMN IF NOT EXISTS preferred_model TEXT DEFAULT NULL;

COMMENT ON COLUMN companies.preferred_model IS 'AI model ID chosen via Model Bake-off (e.g. gpt-5.5, gpt-4.1, gemini-2.5-pro). NULL means use system default.';
