-- Add auto_humanize toggle to companies table
ALTER TABLE companies ADD COLUMN IF NOT EXISTS auto_humanize boolean DEFAULT true;

-- Set existing companies to true (opt-in by default)
UPDATE companies SET auto_humanize = true WHERE auto_humanize IS NULL;
