---
description: "Create a new Supabase Edge Function. Scaffolds the index.ts file with correct Deno structure, JWT auth, CORS, error handling, and wires it into the folder structure."
argument-hint: "Function name (e.g. save-onboarding, icp-enrich)"
agent: agent
---

Create a new Supabase Edge Function named **$ARGUMENTS**.

1. Read the function specification from [gtm.md](../../gtm.md) Section 5 — find the row in the Edge Functions table matching `$ARGUMENTS`. Extract the full spec for this function (trigger, inputs, auth requirement, business logic, return value).

2. Read [edge-functions.instructions.md](../../.github/instructions/edge-functions.instructions.md) for the standard function skeleton, auth patterns, and shared utility usage.

3. Create the file at `supabase/functions/$ARGUMENTS/index.ts` using the standard skeleton. Implement the full logic from the spec — do not stub or skip any logic.

4. Key implementation checks:
   - Extract `org_id` from `user.app_metadata.org_id` ONLY — never from request body or URL
   - Apply `requireRole` if the spec says admin/owner only
   - If this is a cron-triggered function: skip JWT/requireRole, use service role client, query ALL orgs
   - If this is `dodopayments-webhook`: skip JWT, verify HMAC signature only
   - Return `{ error: 'description' }` on all errors — no stack traces
   - Include CORS headers on all responses

5. If the function encrypts/decrypts API keys: use `_shared/encryption.ts` with `ENCRYPTION_KEY` env var.

6. If the function calls AI providers: use `_shared/providers/router.ts` `resolveApiKey` + `routeGeneration`. Call `recordUsage` for non-OpenRouter providers.

7. After creating the file, deploy using Supabase MCP `deploy_edge_function` tool.

8. Test by calling `get_logs` to verify no startup errors.
