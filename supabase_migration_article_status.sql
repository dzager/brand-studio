-- Add status column to articles table for pipeline lifecycle tracking
-- Values: 'generating' | 'ready' | 'failed' | NULL (for legacy articles)
ALTER TABLE articles ADD COLUMN IF NOT EXISTS status text;

-- Set existing articles to 'ready' (they completed before this column existed)
UPDATE articles SET status = 'ready' WHERE status IS NULL AND excerpt != 'Generating article…' AND excerpt != 'Generation failed — please regenerate.';

-- Mark any stuck generating articles as 'failed'
UPDATE articles SET status = 'failed' WHERE status IS NULL AND (excerpt = 'Generating article…' OR excerpt = 'Generation failed — please regenerate.');
