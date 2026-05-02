---
description: "Run the complete GTM Engine Week 1 database setup: enable extensions, apply all 6 migrations, create Storage buckets, seed model data, and verify the schema using Supabase MCP tools."
agent: agent
tools: [supabase]
---

Read the full database schema from [gtm.md](../../gtm.md) (Sections 4 and 7 — all tables, RLS policies, cron jobs, storage buckets, and model seed data).

Then perform the following steps **in order** using Supabase MCP tools:

## Step 1 — Enable extensions
Call `execute_sql` to enable required Postgres extensions:
```sql
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;
```
Then call `list_extensions` to verify all three are active.

## Step 2 — Migration 0001: Initial schema
Write and apply the full initial schema migration using `apply_migration('0001_initial_schema', sql)`.
Include all 17 tables from Sections 4.1–4.17 of the spec.
Critical: use `uuid PRIMARY KEY DEFAULT gen_random_uuid()`, `timestamptz` for all timestamps, `ON DELETE CASCADE` on org_id foreign keys.

## Step 3 — Migration 0002: RLS policies
Apply `apply_migration('0002_rls_policies', sql)`.
Apply the SELECT/INSERT/UPDATE/DELETE RLS policy pattern from Section 4.16 to EVERY table that has an `org_id` column.
Test: call `execute_sql` with `SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public'` — every relevant table must show `rowsecurity = true`.

## Step 4 — Migration 0003: pgvector
Apply `apply_migration('0003_pgvector', sql)`.
**Before running:** call `search_docs` with "pgvector embedding dimensions" to verify the correct vector size for `perplexity/pplx-embed-v1-0.6b`. Add the `brand_context_embedding` column to `brand_contexts` with the correct dimension.
Add an ivfflat index for cosine similarity.

## Step 5 — Migration 0004: pg_cron jobs
Apply `apply_migration('0004_cron_jobs', sql)`.
Schedule all cron jobs from Section 8: `ingest-all-signals` (*/15 * * * *), `poll-generation-jobs` (every minute), `reset-monthly-quotas` (0 0 1 * *), `archive-old-signals` (0 2 * * *), `cleanup-apify-signals` (0 * * * *).

## Step 6 — Migration 0005: Model seed data
Apply `apply_migration('0005_model_seed', sql)`.
Seed all providers from Section 7 into `model_providers` table.
Seed all models from Sections 7.1, 7.2, 7.3 into `available_models` table with correct `default_for_step_key`, `key_source`, `cost_tier`, `compatible_step_keys`, `is_recommended`, and `recommendation_text` values.
Use `INSERT ... ON CONFLICT DO NOTHING`.

## Step 7 — Migration 0006: llm_usage_events + Storage buckets
Apply `apply_migration('0006_usage_and_storage', sql)`.
Create `llm_usage_events` table (Section 4.17) with its RLS policy (authenticated org members SELECT own rows; INSERT service-role-only).
Create the three Storage buckets: `brands`, `assets`, `briefs` (all private).
Apply per-org path isolation RLS on `storage.objects` for each bucket.

## Step 8 — Generate TypeScript types
Call `generate_typescript_types` and save the output to `apps/web/lib/supabase/types.ts`.

## Step 9 — Verification
Call `list_tables` to verify all tables were created.
Call `list_migrations` to confirm all 6 migrations are recorded.
Run a cross-org RLS test:
```sql
-- Create two test users in different orgs, attempt cross-org SELECT — must return 0 rows
```
Report any failures with the specific table or migration that failed.
