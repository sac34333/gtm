---
description: "Build and deploy a complete week of the GTM Engine build order. Use for running Week 1, Week 2, Week 3, etc. Coordinates DB setup, Edge Functions, and frontend pages for that week."
argument-hint: "Week number (1-6)"
agent: agent
tools: [supabase]
---

Implement GTM Engine **Week $ARGUMENTS** from the build order.

1. Read [gtm.md](../../gtm.md) Section 17 — find the Week $ARGUMENTS entry. Extract the complete list of deliverables for this week.

2. Read the end-of-week test for Week $ARGUMENTS from the spec. This is the acceptance criterion — everything built must pass it.

3. **Do not start Week $ARGUMENTS if the previous week's end-of-week test has not been verified.** If this is Week 1, proceed directly.

4. Work through each deliverable in order:

   **For migrations/schema:** Use Supabase MCP `apply_migration` tool. After all migrations are applied, call `generate_typescript_types` and update `apps/web/lib/supabase/types.ts`.

   **For Edge Functions:** Create each function at `supabase/functions/<name>/index.ts` following the edge-functions.instructions.md patterns. Deploy using `deploy_edge_function` MCP tool. Verify with `get_logs`.

   **For frontend pages/components:** Create files in the correct App Router route groups. Include loading/error/empty states for every page.

   **For cron jobs:** Include in migration 0004. If week adds new cron jobs, add them in a new migration.

5. After building all deliverables, run the end-of-week test steps:
   - Use `execute_sql` to verify DB state
   - Use `get_logs` to check for Edge Function errors
   - Report pass/fail for each test criterion

6. List any spec ambiguities encountered and how you resolved them. Flag anything that requires operator input (e.g. setting env vars, configuring Dodo Payments, enabling OpenRouter Broadcast).

**Important constraints:**
- Do NOT implement features from later weeks — spec says to build in strict week order
- Do NOT add features the spec doesn't describe
- Every Edge Function must pass the security rules in Section 14 of the spec
