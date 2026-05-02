-- Migration 0007: Signals status and metadata columns
-- Applied: 2026-05-02T12:07:29Z (version 20260502120729)

-- Add status column to signals (unread/read/bookmarked/dismissed)
ALTER TABLE signals ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'unread';
ALTER TABLE signals ADD COLUMN IF NOT EXISTS matched_themes text[] DEFAULT '{}';
ALTER TABLE signals ADD COLUMN IF NOT EXISTS tags text[] DEFAULT '{}';
ALTER TABLE signals ADD COLUMN IF NOT EXISTS dismissed_at timestamptz;
ALTER TABLE signals ADD COLUMN IF NOT EXISTS dismissed_by uuid;
ALTER TABLE signals ADD COLUMN IF NOT EXISTS scraped_at timestamptz DEFAULT now();
ALTER TABLE signals ADD COLUMN IF NOT EXISTS matched_keywords text[] DEFAULT '{}';
ALTER TABLE signals ADD COLUMN IF NOT EXISTS source_name text;

CREATE INDEX IF NOT EXISTS signals_status_created_idx ON signals(org_id, status, created_at DESC);
