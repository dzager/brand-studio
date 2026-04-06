-- Embedding System — Supabase Migration
-- Run this in your Supabase SQL Editor AFTER enabling the vector extension.
-- Prerequisites: pgvector extension must be enabled (Database → Extensions → "vector" → ON)

-- 1. Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Add embedding column to articles (1536-dim for text-embedding-3-small)
ALTER TABLE articles ADD COLUMN IF NOT EXISTS embedding vector(1536);

-- 3. Add page_embeddings JSONB column to clusters
--    Stores pre-computed embeddings for each planned page in the strategy
ALTER TABLE clusters ADD COLUMN IF NOT EXISTS page_embeddings JSONB DEFAULT '[]';

-- 4. HNSW index for fast cosine similarity search on article embeddings
CREATE INDEX IF NOT EXISTS idx_articles_embedding_hnsw
  ON articles USING hnsw (embedding vector_cosine_ops);

-- 5. RPC function: find similar articles within a company
CREATE OR REPLACE FUNCTION match_company_articles(
  query_embedding vector(1536),
  target_company_id uuid,
  match_threshold float DEFAULT 0.80,
  match_count int DEFAULT 10,
  exclude_article_id uuid DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  title text,
  slug text,
  cluster_id uuid,
  cluster_role text,
  similarity float
)
LANGUAGE sql STABLE
AS $$
  SELECT
    a.id,
    a.title,
    a.slug,
    a.cluster_id,
    a.cluster_role,
    1 - (a.embedding <=> query_embedding) AS similarity
  FROM articles a
  WHERE a.company_id = target_company_id
    AND a.embedding IS NOT NULL
    AND (exclude_article_id IS NULL OR a.id != exclude_article_id)
    AND 1 - (a.embedding <=> query_embedding) > match_threshold
  ORDER BY similarity DESC
  LIMIT match_count;
$$;
