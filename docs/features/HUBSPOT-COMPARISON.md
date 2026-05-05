# GTM Engine vs HubSpot — Feature Comparison

> **Scope:** HubSpot **Marketing Hub** + **Content Hub** vs **GTM Engine** as it stands May 2026.
> **Purpose:** Honest side-by-side so we can decide what to keep, what to build, and what to position around. Not a sales asset.

---

## 1. TL;DR positioning

| | HubSpot Marketing Hub + Content Hub | GTM Engine |
|---|---|---|
| **Core promise** | All-in-one CRM-anchored marketing platform | AI-native GTM intelligence + outbound campaign generator |
| **Pricing entry** | Free → Starter ~$20/mo → Pro ~$890/mo → Enterprise ~$3,600/mo (per seat tiers add up fast) | Flat $20/mo BYOK, no seat tax |
| **AI model** | Locked to HubSpot's "Breeze" | **BYOK** — OpenRouter, OpenAI, Anthropic, Gemini, fal — pick any model per step |
| **Setup time** | Same-day for basics; weeks for SEO/ads/CMS | < 10 min onboarding wizard |
| **Lock-in** | High — content, contacts, automations all live in HubSpot | Low — your keys, your data, exportable |
| **Where we win** | AI flexibility, signal intelligence, ICP enrichment, price | |
| **Where they win** | CRM, full CMS, email infrastructure, ecosystem (2,000+ integrations) | |

---

## 2. Feature-by-feature parity matrix

### 2a. Marketing Hub

| Capability | HubSpot | GTM Engine | Notes |
|---|---|---|---|
| Multi-channel campaign creation | ✅ Email, social, ads, landing pages | ✅ LinkedIn, Twitter/X, Email, Cold call scripts | We don't do paid ads or landing pages |
| Personalized automated campaigns | ✅ Workflows, lists, branching | 🟡 Per-prospect personalization via `personalise` function, no workflow builder | Differs in mental model — they automate, we generate |
| Social media management | ✅ Schedule + publish to all networks | ❌ We generate copy, don't publish | **Gap** — could add via Buffer/Typefully API |
| Campaign management | ✅ Shared calendar, tasks, assets, attribution | ✅ Campaign briefs, prospect tracking, copy approval, configurable duration calendar | Ours is generation-first, theirs is execution-first |
| Built-in analytics & reporting | ✅ Customizable dashboards, multi-touch attribution | 🟡 Trend dashboard, signal analytics, usage stats | **Gap** — no revenue attribution, no funnel reports |
| Email infrastructure | ✅ Send servers, deliverability, suppression | ❌ We hand off copy to user's stack | Intentional — we don't want to be an ESP |
| Ad tracking | ✅ Google/Meta/LinkedIn ads | ❌ | Out of scope for now |
| **Productivity AI agents** | ✅ Content agent, social agent | ✅ Asset generation, brief generation, captions, refinement, ICP enrichment, signal ingestion | More agents, more granular |
| Lead scoring | ✅ Predictive + manual | 🟡 ICP score (0-100) on enriched contacts | Different angle — fit, not engagement |
| Salesforce sync | ✅ Bi-directional | ❌ | **Gap** if we ever go enterprise |

### 2b. Content Hub

| Capability | HubSpot | GTM Engine | Notes |
|---|---|---|---|
| AI content generation | ✅ Breeze content agent | ✅ Asset gen, brief gen, captions across all major model providers | We're more flexible (BYOK), they're more polished |
| Brand Voice | ✅ Detects + applies your voice | ✅ `brand_contexts` table feeds every prompt (company, tone, ICP, themes) | Equivalent capability, different UX |
| Content Remix (one asset → many formats) | ✅ Blog → social → email | 🟡 We do social captions from a brief | **Gap** — no full multi-format remix yet |
| Case Study Generator | ✅ Upload transcript → case study | ❌ | **Gap** — easy to add given our infra |
| CMS / website builder | ✅ Full hosted CMS, themes, drag-drop | ❌ | Won't build — out of scope |
| SEO Recommendations | ✅ Page-level optimization | ❌ | **Gap** — could add via Tavily/Brave Search |
| Memberships / gated content | ✅ | ❌ | Out of scope |
| Video & podcast hosting | ✅ | 🟡 We generate videos via fal, no hosting | Storage layer exists, no player/CDN UX |
| A/B testing | ✅ Page + email | ❌ | **Gap** |
| Asset management (DAM) | ✅ Centralized library | 🟡 Storage buckets per org, no library UI | **Gap** — could surface |
| **AEO (Answer Engine Optimization)** | ✅ AEO Grader + AEO Strategy [beta] | 🔜 Spec'd in [`AEO.md`](./AEO.md), backlogged | **Build later** — already designed |
| Blog research agent | ✅ Beta — high-intent topic suggestions | 🟡 We have signal ingestion (RSS, HN, Reddit, etc.) — different angle | We surface what's trending in the market, they surface what to write next |
| Lookalike lists | ✅ Find similar contacts in DB | 🟡 ICP enrichment finds new prospects matching ideal profile | Comparable outcome, different data path |

---

## 3. Where GTM Engine genuinely wins

These are the moats — lead with them.

1. **BYOK across every AI provider.**
   HubSpot's "Breeze" is a black box. We let the customer pick **GPT, Claude, Gemini, Llama, DeepSeek, Qwen, Flux, Veo** per task and pay model providers directly. For any team with strong opinions on model quality or cost — that's decisive.

2. **Signal intelligence.**
   Daily ingestion from RSS, HackerNews, ProductHunt, GitHub, YouTube, Reddit, NewsAPI, GDELT, LinkedIn (via Apify), Tavily, Brave. **HubSpot does not have this.** Their content suggestions come from your existing performance; ours come from the broader market.

3. **ICP enrichment + per-prospect personalization.**
   PDL → Apollo → Hunter → Clearbit → web-scrape waterfall, ICP score 0-100, then `personalise` writes copy tuned to each enriched prospect. HubSpot has lookalike lists but doesn't do per-record AI personalization at this depth.

4. **Configurable campaign calendars (1-90 days).**
   With or without weekends. HubSpot makes you build campaign timelines manually in their workflow editor — slow.

5. **Price.**
   $20/mo flat, BYOK. HubSpot Marketing Pro is **$890/mo + seat costs**. Content Hub Pro adds another $500/mo. Even our planned $50/mo platform-paid tier would be ~10x cheaper than equivalent HubSpot.

6. **No per-seat tax.**
   HubSpot charges per editor seat. We don't.

7. **No data lock-in.**
   Customer's API keys, customer's outputs, exportable Postgres tables. HubSpot keeps your contacts, content, and automations behind their walls.

8. **Speed of iteration.**
   We ship features in days (configurable duration: spec → shipped in one session). HubSpot ships quarterly.

---

## 4. Where HubSpot wins (today)

Be honest about these in any sales conversation.

1. **CRM.** Contacts, companies, deals, tickets, attribution — all native. We have no CRM and don't want to be one. We assume the customer has a CRM (Salesforce, HubSpot, Pipedrive) elsewhere.

2. **Email send infrastructure.** Deliverability, IP warming, suppression lists, RFC compliance. We generate copy; they send the email and track opens/clicks.

3. **Hosted CMS + landing pages + forms.** Their bread and butter. We don't compete here.

4. **Paid ads management.** Google/Meta/LinkedIn ads in one console. Out of scope for us.

5. **2,000+ integrations marketplace.** We have Dodo Payments, Sentry, Langfuse, Apify, fal, OpenRouter, etc. Ecosystem is years of work to match.

6. **Multi-touch revenue attribution.** Their reporting depth is real. We surface usage stats and trend data, not full-funnel ROI.

7. **Brand recognition + SOC 2 + procurement-friendliness.** Enterprise procurement teams already approve HubSpot. We're new.

8. **Memberships, podcasts, A/B testing, video hosting.** Native in Content Hub.

9. **Salesforce bi-directional sync.** Make-or-break for any team running Salesforce as system of record.

---

## 5. Strategic gaps to consider building

Ranked by **leverage / effort**:

| Feature | Build effort | Strategic value | Recommendation |
|---|---|---|---|
| **AEO module** ([spec](./AEO.md)) | 2 weeks | **High** — directly competes with HubSpot's flagship beta, BYOK makes it 10x cheaper | **Yes — top of queue** |
| **Content Remix** (brief → blog → tweets → email → carousel) | 3–5 days | High — pure AI play, fits our infra perfectly | **Yes** — natural extension of generate-asset |
| **Case Study Generator** (upload transcript → case study) | 2–3 days | Medium — good demo, niche use | **Yes, low effort** |
| **Social publishing** (Buffer/Typefully API) | 1 week | High — closes the loop from generation to distribution | **Yes** if we get user demand |
| **Funnel/attribution analytics** | 2+ weeks | Medium — only matters if we host the email send too | **No** — let the user's CRM handle this |
| **Salesforce sync** | 3+ weeks | High for enterprise, low for SMB | **Defer** until first enterprise asks |
| **A/B testing on copy** | 1 week | Medium | **Maybe** — only if we add publishing |
| **SEO Recommendations** | 1 week | Medium — Tavily/Brave makes it cheap | **Maybe** |
| **DAM / asset library UI** | 3–5 days | Low — storage already exists | **Maybe** — small UX polish |
| **CMS / landing pages** | Months | Low — commodity, lots of competitors | **No** |

---

## 6. Pricing comparison

| Tier | HubSpot Marketing Hub | HubSpot Content Hub | GTM Engine |
|---|---|---|---|
| **Free** | Limited contacts, branded forms | Limited pages | n/a (we start at $20) |
| **Starter** | ~$20/mo, 1,000 contacts | ~$20/mo | **$20/mo BYOK — full feature set** |
| **Professional** | ~$890/mo + seats, 2,000 contacts | ~$500/mo + seats | n/a |
| **Enterprise** | ~$3,600/mo + seats, 10,000 contacts | ~$1,500/mo + seats | Roadmap (custom) |
| **AEO add-on** | ₹4,170/mo (~$50) | included in Pro | $20–35 (planned) |

**Honest take:** HubSpot's Free tier is the toughest competitor — many small teams will pick it just to get the CRM. We compete on **speed, AI flexibility, and the feature combination** (signal intel + ICP enrichment + personalized outbound), not on free.

---

## 7. The positioning sentence

> *GTM Engine is what HubSpot would build if it started in 2026, was AI-native, and let you bring your own model keys. We don't replace your CRM or email server — we feed them with sharper signals, better-fit prospects, and content generated by whichever AI model is best for each task.*

---

## 8. Decisions for product roadmap

Pick from this list when planning the next 4 weeks:

1. **Build AEO** — biggest competitive win, 2 weeks, spec ready
2. **Build Content Remix** — high leverage, 3-5 days, fits perfectly
3. **Build Case Study Generator** — fast demo win, 2-3 days
4. **Build social publishing integration** — closes the loop, 1 week
5. **Stay focused on outbound + signals** — sharpen what already works, ignore HubSpot

Recommendation: **1 → 3 → 2** in that order. Skip 4 and 5 for now unless asked.

---

*Captured: 2026-05-05. Refresh after any HubSpot quarterly release or our next pricing review.*
