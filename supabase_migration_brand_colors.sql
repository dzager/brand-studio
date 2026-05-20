-- Migration: Add brand_colors JSONB column to companies table
-- This allows storing an unlimited palette of named brand colors
-- Format: [{ "name": "Primary", "hex": "#2c2c2c" }, { "name": "Accent", "hex": "#fdfe52" }, ...]

ALTER TABLE companies
ADD COLUMN IF NOT EXISTS brand_colors JSONB DEFAULT '[]'::jsonb;

-- Backfill existing primary/secondary into the new column
UPDATE companies
SET brand_colors = jsonb_build_array(
    jsonb_build_object('name', 'Primary', 'hex', COALESCE(color_primary, '#000000')),
    jsonb_build_object('name', 'Secondary', 'hex', COALESCE(color_secondary, '#FFFFFF'))
)
WHERE brand_colors IS NULL OR brand_colors = '[]'::jsonb;
