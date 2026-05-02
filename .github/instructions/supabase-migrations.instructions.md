---
description: "Use when writing Supabase migration SQL files, creating tables, RLS policies, pg_cron jobs, pgvector setup, or any schema changes. Covers naming conventions, patterns, and safety rules."
applyTo: "supabase/migrations/**"
---

# Supabase Migration Guidelines

## Naming and ordering

Files: `0001_initial_schema.sql`, `0002_rls_policies.sql`, `0003_pgvector.sql`, `0004_cron_jobs.sql`, `0005_model_seed.sql`, `0006_usage_and_storage.sql`

New migrations: increment the prefix, use snake_case description. **Never edit an already-applied migration** — create a new one.

## Always use MCP to apply

After writing SQL, call `apply_migration(name, sql)` via Supabase MCP. This tracks the migration in the database. Do NOT use `execute_sql` for DDL.

After applying schema changes, call `generate_typescript_types` and save output to `apps/web/lib/supabase/types.ts`.

## Table conventions

```sql
-- All tables use these patterns:
id            uuid PRIMARY KEY DEFAULT gen_random_uuid()
org_id        uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE
created_at    timestamptz NOT NULL DEFAULT now()
updated_at    timestamptz NOT NULL DEFAULT now()  -- only on mutable tables
```

## RLS pattern (apply to every table with org_id — Section 4.16 of spec)

```sql
ALTER TABLE <table_name> ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_isolation_select" ON <table_name>
  FOR SELECT USING (org_id = (auth.jwt() ->> 'org_id')::uuid);

CREATE POLICY "org_isolation_insert" ON <table_name>
  FOR INSERT WITH CHECK (org_id = (auth.jwt() ->> 'org_id')::uuid);

CREATE POLICY "org_isolation_update" ON <table_name>
  FOR UPDATE USING (org_id = (auth.jwt() ->> 'org_id')::uuid);

CREATE POLICY "org_isolation_delete" ON <table_name>
  FOR DELETE USING (org_id = (auth.jwt() ->> 'org_id')::uuid);
```

Service role clients bypass RLS — this is intentional for cron functions and admin operations.

## pgvector (migration 0003)

```sql
CREATE EXTENSION IF NOT EXISTS vector;
ALTER TABLE brand_contexts ADD COLUMN IF NOT EXISTS
  brand_context_embedding vector(1536);  -- VERIFY dimension matches embedding model output first
CREATE INDEX ON brand_contexts USING ivfflat (brand_context_embedding vector_cosine_ops);
```

**CRITICAL:** Verify the output dimension of `perplexity/pplx-embed-v1-0.6b` before running this migration. If it outputs 1024 dims, use `vector(1024)`. Mismatch causes every INSERT to fail.

## pg_cron (migration 0004)

```sql
SELECT cron.schedule('job-name', '*/15 * * * *',
  $$SELECT net.http_post(
    url := current_setting('app.supabase_url') || '/functions/v1/function-name',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.service_role_key')
    ),
    body := '{}'::jsonb
  )$$
);
```

## Storage buckets (migration 0006)

```sql
INSERT INTO storage.buckets (id, name, public) VALUES
  ('brands', 'brands', false),
  ('assets', 'assets', false),
  ('briefs', 'briefs', false)
ON CONFLICT (id) DO NOTHING;

-- Per-org path isolation RLS on storage.objects
CREATE POLICY "brands_org_select" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'brands' AND
    (storage.foldername(name))[1] = (
      SELECT org_id::text FROM org_members WHERE user_id = auth.uid() LIMIT 1
    )
  );
-- Repeat pattern for assets and briefs buckets
-- INSERT/UPDATE/DELETE on storage.objects: service-role-only (no RLS policy needed)
```

## Seeding model data (migration 0005)

Use `INSERT INTO model_providers ... ON CONFLICT DO NOTHING` and `INSERT INTO available_models ... ON CONFLICT (provider_key, model_id) DO NOTHING`. Copy all providers and models from Section 7 of the spec exactly.

## Verification after applying

```sql
-- Verify tables exist
SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';
-- Verify RLS is enabled
SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public';
-- Verify extensions
SELECT * FROM pg_extension WHERE extname IN ('vector', 'pg_cron', 'pg_net');
```
