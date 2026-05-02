-- Migration 0003: pgvector extension and embedding support
-- Applied: 2026-05-02T10:32:07Z (version 20260502103207)

CREATE EXTENSION IF NOT EXISTS vector;

-- brand_context_embedding column was added in 0001 as vector(1536)
-- This migration ensures the extension is present and adds HNSW index

CREATE INDEX IF NOT EXISTS brand_contexts_embedding_idx
  ON brand_contexts USING hnsw (brand_context_embedding vector_cosine_ops);
