---
description: "Debug a Supabase Edge Function error. Fetches recent logs, identifies the issue, and applies a fix."
argument-hint: "Function name (e.g. generate-asset, ingest-signals)"
agent: agent
tools: [supabase]
---

Debug the Supabase Edge Function **$ARGUMENTS**.

1. Call `get_logs` with service type `edge-functions` and filter for `$ARGUMENTS` to get recent error logs.

2. Identify the error type:
   - **401 Unauthorized**: Check JWT extraction — org_id must come from `user.app_metadata.org_id`
   - **403 Forbidden**: Check CORS origin (must be `https://gtmengine.qubitlyventures.com` or `http://localhost:3000`), or check `requireRole` call, or check `key_source` for AI provider
   - **500 Internal Error**: Check Deno import paths (use `npm:` prefix), check env vars are set, check DB query errors
   - **Cron failures**: Verify the function does NOT require a user JWT (cron uses service role key)

3. Read the current function code at `supabase/functions/$ARGUMENTS/index.ts`.

4. Read the function spec from [gtm.md](../../gtm.md) Section 5 to verify the implementation matches the spec.

5. Apply the fix. If the fix involves a schema change, use `apply_migration` via Supabase MCP.

6. Deploy the fixed function using `deploy_edge_function` MCP tool.

7. Call `get_logs` again to verify the error is resolved.
