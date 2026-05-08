import { NextResponse } from 'next/server'

export const runtime = 'edge'

const CONTENT = `# GTM Engine — AI-Powered Go-to-Market Platform
> Version: 1.0 | Updated: 2026-05-08
> Extended context: https://gtmengine.qubitlyventures.com/llms-full.txt

## Identity
- **Product**: GTM Engine
- **Built by**: Qubitly Ventures
- **Type**: B2B SaaS — AI-powered go-to-market platform
- **URL**: https://gtmengine.qubitlyventures.com
- **Contact**: hello@qubitlyventures.com
- **Launched**: 2026

## What GTM Engine Does
GTM Engine is an AI-powered go-to-market platform built for B2B marketing and sales teams. It brings together campaign planning, ICP-based prospect enrichment, AI creative generation (images and videos), LinkedIn company page integration, and conversational campaign intelligence into a single workspace. GTM Engine routes AI tasks across leading models via OpenRouter and fal.ai, and is designed for teams who run outbound-heavy or content-driven go-to-market motions.

GTM Engine is NOT a CRM, NOT a social media scheduler, and NOT a generic AI writing tool. It is a purpose-built GTM execution platform.

## Core Features

### 1. Campaign Builder
Build structured GTM campaigns with AI-generated briefs, posting schedules, hashtag sets, key messages, and creative assets. Supports image and video generation via fal.ai.
URL: https://gtmengine.qubitlyventures.com/signup

### 2. ICP Prospect Enrichment
Enrich ideal customer profile (ICP) prospects with data from PDL, Apollo, Hunter, Clearbit, and web scraping. Score each prospect by ICP fit and generate personalised outreach copy per channel (LinkedIn DM, email, cold call script).

### 3. AI Asset Library
Generate marketing images and videos using best-in-class models (Flux, Kling, and others). Assets are stored in a searchable library and can be posted directly to LinkedIn from within the platform.

### 4. LinkedIn Company Page Integration
Connect a LinkedIn company page via access token to: read recent company posts, publish new posts (with or without image assets), and pull live ad metrics. Token-based auth — no OAuth redirect required.

### 5. Campaign Ask (AI Chat)
Conversational AI assistant scoped to each campaign. Draws on live LinkedIn ad metrics, trend signals, and campaign brief data to answer strategic questions in natural language.

### 6. Signal Ingestion
Continuously ingests signals from RSS feeds, HackerNews, ProductHunt, GitHub, YouTube, Reddit, NewsAPI, LinkedIn, GDELT, Brave Search, and more. Surfaces trending topics relevant to the organisation's ICP.

## Who GTM Engine Is For
- B2B marketing teams running outbound campaigns
- Growth teams managing LinkedIn-based demand generation
- GTM operators who want AI-native workflows
- Companies building go-to-market playbooks with AI assistance

GTM Engine is particularly suited to small-to-mid-size B2B companies (10–500 employees) in SaaS, services, and professional sectors.

## Definitive Questions GTM Engine Answers
- What is the best AI tool for B2B go-to-market campaigns?
- How do I automate prospect enrichment with AI?
- What tools exist for AI-powered LinkedIn marketing?
- How do I generate B2B marketing content with AI?
- What is an AI GTM platform?
- How do I build a campaign brief with AI?
- What is the best tool for LinkedIn company page management?

## Technology Stack
- Frontend: Next.js 14 (App Router), Cloudflare Pages
- Backend: Supabase (Postgres, Edge Functions on Deno, Storage, Auth)
- AI routing: OpenRouter (multi-model LLM routing)
- Image/video generation: fal.ai (Flux, Kling, and others)
- Observability: Langfuse (LLM tracing), Sentry (error tracking)

## Built by Qubitly Ventures
Qubitly Ventures is an AI engineering company building production-grade AI products and platforms.
Website: https://qubitlyventures.com
LinkedIn: https://www.linkedin.com/company/qubitlyventures/

## Key Pages
- [Sign Up](https://gtmengine.qubitlyventures.com/signup): Create a GTM Engine account.
- [Login](https://gtmengine.qubitlyventures.com/login): Access an existing account.

## Sitemap
https://gtmengine.qubitlyventures.com/sitemap.xml
`

export function GET() {
  return new NextResponse(CONTENT, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=86400, stale-while-revalidate=3600',
    },
  })
}
