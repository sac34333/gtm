---
description: "Apply a new database migration directly to Supabase using MCP. Write the SQL, apply it, and regenerate TypeScript types."
argument-hint: "Migration purpose (e.g. add prospect company_description column)"
agent: agent
tools: [supabase]
---

Apply a new Supabase migration for: **$ARGUMENTS**

1. Determine the next migration number by calling `list_migrations` via Supabase MCP.

2. Write the SQL for the migration. Follow these rules:
   - DDL changes (CREATE TABLE, ALTER TABLE, CREATE INDEX, RLS policies): use `apply_migration`
   - DML only (INSERT seed data, UPDATE existing rows): use `execute_sql`
   - New tables must include RLS policies (SELECT/INSERT/UPDATE/DELETE using `org_id = (auth.jwt() ->> 'org_id')::uuid`)
   - New columns on existing tables: use `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`
   - Never drop a column without explicit confirmation from the user

3. Call `apply_migration(name, sql)` where name follows the pattern `NNNN_description` (e.g. `0007_add_company_description`).

4. Verify the migration applied correctly:
   - Call `list_tables` or `execute_sql` to inspect the result
   - For new columns: `SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'table_name'`
   - For RLS: `SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public' AND tablename = 'table_name'`

5. Call `generate_typescript_types` and update `apps/web/lib/supabase/types.ts` with the new output.

6. Report what was changed, what was verified, and any warnings.
