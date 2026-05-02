# GTM Engine

AI-powered go-to-market platform. Generate brand-aligned images and videos from real-time market signals, enrich ICPs, and run personalised campaigns — all within your organisation's brand guardrails.

---

## Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14 App Router |
| Database / Auth / Storage | Supabase (Postgres + pgvector) |
| Edge Functions | Deno (Supabase Edge Functions) |
| AI — images | fal.ai (Flux, SDXL) |
| AI — video | fal.ai (Kling, MiniMax, LTX) |
| AI — text | OpenRouter → Anthropic / OpenAI / Google |
| Observability | Langfuse |
| Error tracking | Sentry |
| Billing | Dodo Payments |
| Styling | Tailwind CSS v3 + shadcn/ui |

---

## Local Setup

### Prerequisites

- Node.js 20+
- [Supabase CLI](https://supabase.com/docs/guides/cli)
- A Supabase project (or local instance via `supabase start`)

### 1. Clone and install

```bash
git clone <repo-url>
cd gtmengine/apps/web
npm install
```

### 2. Environment variables

Copy `.env.local.example` to `.env.local` and fill in the values:

```bash
cp .env.local.example .env.local
```

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key |
| `NEXT_PUBLIC_SENTRY_DSN` | Sentry DSN (optional, errors silently dropped if absent) |
| `NEXT_PUBLIC_APP_URL` | App base URL (`http://localhost:3000` for local) |
| `NEXT_PUBLIC_DODO_PRODUCT_GROWTH` | Dodo Payments product ID for Growth plan |
| `NEXT_PUBLIC_DODO_PRODUCT_SCALE` | Dodo Payments product ID for Scale plan |
| `SENTRY_ORG` | Sentry org slug (build-time source maps only) |
| `SENTRY_PROJECT` | Sentry project slug |

### 3. Run migrations

```bash
cd ../..   # project root
npx supabase db push --project-ref <your-project-ref>
```

### 4. Deploy Edge Functions

```bash
npx supabase functions deploy --project-ref <your-project-ref>
```

Set the following secrets in the Supabase dashboard or via CLI:

```bash
npx supabase secrets set \
  ENCRYPTION_KEY=<32-byte-hex> \
  FAL_API_KEY=<key> \
  OPENROUTER_API_KEY=<key> \
  LANGFUSE_SECRET_KEY=<key> \
  LANGFUSE_PUBLIC_KEY=<key> \
  DODO_WEBHOOK_SECRET=<secret> \
  DODO_API_KEY=<key> \
  --project-ref <your-project-ref>
```

### 5. Start the dev server

```bash
cd apps/web
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Project Structure

```
gtm-engine/
  apps/web/              → Next.js 14 App Router frontend
  supabase/
    migrations/          → SQL schema migrations (0001–0010)
    functions/           → Deno Edge Functions
      _shared/           → auth, db, encryption, observability, providers, sources, enrichment
  .github/
    copilot-instructions.md
    instructions/        → Scoped coding instructions
    prompts/             → Reusable prompt templates
```

---

## Architecture

### Signal Ingestion

A `pg_cron` job calls `ingest-signals` every 15 minutes. It iterates over each org's enabled data sources, fetches new items via source adapters (RSS, HackerNews, LinkedIn via Apify, Reddit, NewsAPI, etc.), runs TF-IDF relevance scoring against the org's ICP keywords, and stores signals with embeddings in Postgres.

### Asset Generation

1. Frontend calls `build-prompt` with `prompt_tags` + optional `signal_id`
2. `build-prompt` assembles a GPT-4o prompt incorporating brand context, ICP, and signal content
3. `generate-asset` routes to the appropriate provider (fal.ai for images/video, OpenRouter for text)
4. For async video jobs, `poll-job-status` is called by `pg_cron` and broadcasts completion via Supabase Realtime

### ICP Enrichment

`icp-enrich` runs a waterfall: PDL → Apollo → Hunter → Clearbit → web_scrape. Results are merged into `icp_profiles` with an `icp_score` (0–100).

### Billing

Dodo Payments handles subscriptions. The `dodopayments-webhook` Edge Function processes `subscription.created/updated/cancelled` events and updates the org's `plan_tier`, seat limits, and quotas. Quota enforcement happens in `generate-asset` (HTTP 402) and `check-quota`.

---

## Security

- All API keys encrypted at rest (AES-256-GCM) before storage
- JWT `app_metadata.org_id` for all org isolation — never from request body
- Row-Level Security on every table with `org_id`
- CORS restricted to `https://gtmengine.qubitlyventures.com` and `http://localhost:3000`
- No stack traces in API responses
- Signal content treated as untrusted — never executed as instructions

---

## License

Proprietary — Qubitly Ventures
