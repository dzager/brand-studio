-- Migration: Add featured video support to articles
-- When featured_video_url is set, the article renders a video instead of image_base64.
-- Setting a new image clears the video fields, and vice versa.

ALTER TABLE articles ADD COLUMN IF NOT EXISTS featured_video_url text;
ALTER TABLE articles ADD COLUMN IF NOT EXISTS featured_video_platform text; -- 'youtube' | 'vimeo'
