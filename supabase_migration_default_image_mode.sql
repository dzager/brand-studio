-- Add default_image_mode column to companies table
-- Values: 'generate' (AI-generated images, default) or 'library' (search/match from web)
ALTER TABLE companies
ADD COLUMN IF NOT EXISTS default_image_mode text DEFAULT 'generate';
