-- Migration 0008: Feed configs additional columns
-- Applied: 2026-05-02T12:08:43Z (version 20260502120843)

ALTER TABLE feed_configs ADD COLUMN IF NOT EXISTS source_url text;
ALTER TABLE feed_configs ADD COLUMN IF NOT EXISTS source_label text;
ALTER TABLE feed_configs ADD COLUMN IF NOT EXISTS keywords text[] DEFAULT '{}';
ALTER TABLE feed_configs ADD COLUMN IF NOT EXISTS api_key_ref text;
ALTER TABLE feed_configs ADD COLUMN IF NOT EXISTS error_count integer DEFAULT 0;
ALTER TABLE feed_configs ADD COLUMN IF NOT EXISTS requires_api_key boolean DEFAULT false;
ALTER TABLE feed_configs ADD COLUMN IF NOT EXISTS auto_activated boolean NOT NULL DEFAULT false;
ALTER TABLE feed_configs ADD COLUMN IF NOT EXISTS cron_expression text;
