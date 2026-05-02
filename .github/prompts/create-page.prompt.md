---
description: "Create a new Next.js 14 App Router page with auth guard, loading/error/empty states, and correct data fetching pattern. Specify the route path."
argument-hint: "Route path (e.g. /dashboard, /settings/usage, /icp)"
agent: agent
---

Create the Next.js 14 App Router page for route **$ARGUMENTS**.

1. Read the page specification from [gtm.md](../../gtm.md) Section 11 — find the matching route in the route map and read the full page description for that route.

2. Read [nextjs-frontend.instructions.md](../../.github/instructions/nextjs-frontend.instructions.md) for file conventions, Supabase client patterns, state management, and UI requirements.

3. Determine the correct file path from the App Router route group structure:
   - Public routes → `apps/web/app/(public)/`
   - Onboarding routes → `apps/web/app/(onboarding)/`
   - Protected routes → `apps/web/app/(dashboard)/`

4. Create the page file. It must include:
   - **Auth guard**: protected pages go inside `(dashboard)/` which has `layout.tsx` for auth — do not re-implement auth in the page itself
   - **Loading state**: `loading.tsx` sibling with skeleton UI using shadcn `<Skeleton />`
   - **Error state**: `error.tsx` sibling with user-friendly message and retry button
   - **Empty state**: meaningful empty state with action CTA (no blank screens)
   - **Role check**: hide admin/owner-only actions based on `user.app_metadata.role`

5. Data fetching:
   - Server Components: use `createSupabaseServer()` for initial data
   - Client Components: use TanStack Query `useQuery` with a fetch function that calls Edge Functions with the user JWT
   - Mutations: use `useMutation` with `queryClient.invalidateQueries` on success

6. Use shadcn/ui components throughout. Install any missing components with `npx shadcn@latest add <component>` before using them.

7. Create any required sub-components in the appropriate `apps/web/components/` subdirectory:
   - Brand/onboarding → `components/brand/`
   - Signal/dashboard → `components/signals/`
   - Generation → `components/generation/`
   - ICP/prospects → `components/icp/`
   - Campaign → `components/campaign/`
   - Layout/nav → `components/layout/`
