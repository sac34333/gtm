---
description: "Week 5 — ICP, personalisation, campaign brief: icp-enrich (PDL waterfall), personalise, generate-campaign-brief (PDF), /icp, /icp/[id]/personalise, /campaigns."
agent: agent
tools: [supabase]
---

# Week 5 — ICP Discovery, Personalisation, and Campaign Brief

Read the master spec at [gtm.md](../../gtm.md) Sections 5, 11.6, 11.7, 12, and check the @react-pdf/renderer WARNING in Section 5. Weeks 1–4 must be complete before starting.

## STOP CHECK
Run the Week 4 end-of-week test (video generation flow). All must pass. Then check `get_logs` on all deployed Edge Functions.

---

## PART 1 — Enrichment Adapters (_shared/enrichment/)

### enrichment/pdl.ts
`enrichPDL(criteria: ICPCriteria, apiKey: string): Promise<Prospect[]>` — People Data Labs API.
- POST `https://api.peopledatalabs.com/v5/person/search` with `Authorization: Bearer {apiKey}`
- Build query from criteria: map `industries` to PDL `job_company_industry`, `geographies` to `location_country`, `titles` to `job_title`, `company_sizes` to `job_company_size`, `domains` to `job_company_website`
- Free tier: 1000 records/month. Fetch up to 100 per request.
- Map PDL response fields to Prospect schema: `full_name → first_name + last_name`, `work_email → email`, `job_title → title`, `job_company_name → company_name`, `job_company_website → company_domain`, `job_company_employee_count → company_size`, `industry → industry`, `location_country → country`, `linkedin_url → linkedin_url`
- `company_description`: map from PDL `job_company_description` if present. NULL if not.

### enrichment/apollo.ts
`enrichApollo(criteria: ICPCriteria, apiKey: string): Promise<Prospect[]>` — Apollo.io.
- POST `https://api.apollo.io/v1/mixed_people/search` with `api_key: {key}` in body
- Map criteria to Apollo params: `person_titles`, `organization_industry_tag_ids`, `organization_num_employees_ranges`, `person_locations`
- Free tier: 50 exports/month. Map response to Prospect schema.
- `company_description`: from `organization.short_description` if present.

### enrichment/hunter.ts
`enrichHunter(domain: string, apiKey: string): Promise<{email: string | null}>` — email finder only.
- GET `https://api.hunter.io/v2/domain-search?domain={domain}&api_key={key}`
- Returns the most common email pattern. Used to fill email gaps after PDL and Apollo.
- Free tier: 25 searches/month.

### enrichment/clearbit.ts
`enrichClearbit(domain: string, apiKey: string): Promise<CompanyData>` — company enrichment only.
- GET `https://company.clearbit.com/v2/companies/find?domain={domain}` with `Authorization: Bearer {key}`
- Returns: name, description, employee_count, industry, country.
- `company_description`: map from Clearbit `description`.

### enrichment/web_scrape.ts
`scrapePublicProfile(url: string): Promise<Partial<Prospect>>` — scrape company /about page.
- Fetch HTML from the provided URL (with a 10-second timeout)
- Extract company description from meta description tag and visible text in first 2000 chars
- Store extracted text in `company_description`
- Store in `enrichment_source = 'web_scrape'`
- NEVER store LinkedIn scraped data raw — only map to normalised Prospect fields

---

## PART 2 — icp-enrich Edge Function

Create `supabase/functions/icp-enrich/index.ts`. POST — any authenticated org member.

### Input:
```typescript
{
  industries: string[],
  company_sizes: string[],  // 'smb' | 'mid-market' | 'enterprise'
  geographies: string[],    // ISO country codes
  titles: string[],
  keywords: string[],
  domains: string[]         // optional: specific target company domains
}
```

### Logic (spec Section 12):
1. Extract `org_id` from JWT
2. Save criteria to `brand_contexts.last_icp_criteria = {industries, company_sizes, geographies, titles, keywords, domains}` for this org (so /icp page can pre-populate form next time)
3. Run waterfall — stop adding fields once filled, not all steps on all prospects:

   **Step 1 — PDL** (if `PDL_API_KEY` env var set):
   ```typescript
   const pdlProspects = await enrichPDL(criteria, Deno.env.get('PDL_API_KEY')!)
   ```
   PDL platform key — NOT per-org.

   **Step 2 — Apollo** (if `APOLLO_API_KEY` set, for prospects still missing email/company):
   ```typescript
   const apolloProspects = await enrichApollo(criteria, Deno.env.get('APOLLO_API_KEY')!)
   // Merge with PDL results: fill gaps (email, company_description) for matching LinkedIn URLs or names
   ```

   **Step 3 — Hunter** (for prospects still missing email, has company_domain):
   ```typescript
   for (const prospect of mergedProspects.filter(p => !p.email && p.company_domain)) {
     const {email} = await enrichHunter(prospect.company_domain, Deno.env.get('HUNTER_API_KEY')!)
     if (email) prospect.email = email
   }
   ```

   **Step 4 — Clearbit** (for prospects still missing company_description, has company_domain):
   ```typescript
   for (const prospect of mergedProspects.filter(p => !p.company_description && p.company_domain)) {
     const company = await enrichClearbit(prospect.company_domain, Deno.env.get('CLEARBIT_API_KEY')!)
     if (company.description) prospect.company_description = company.description
   }
   ```

   **Step 5 — Web scrape** (fallback for any prospects still missing fields):
   ```typescript
   for (const prospect of mergedProspects.filter(p => !p.company_description && p.company_domain)) {
     const scraped = await scrapePublicProfile(`https://${p.company_domain}/about`)
     if (scraped.company_description) prospect.company_description = scraped.company_description
   }
   ```

   > **RULE (spec Section 12):** If a step throws, catch the error, log it, and continue with next step. NEVER fail the whole enrichment because one step failed.

4. **Compute icp_score** for each prospect (spec Section 12.3):
   ```typescript
   function computeIcpScore(prospect: Prospect, criteria: ICPCriteria): number {
     const weights = {industries: 25, titles: 25, company_sizes: 20, geographies: 20, keywords: 10}
     let matched = 0, total = 0
     if (criteria.industries?.length) {
       total += weights.industries
       if (criteria.industries.some(i => i.toLowerCase() === prospect.industry?.toLowerCase())) matched += weights.industries
     }
     if (criteria.titles?.length) {
       total += weights.titles
       if (criteria.titles.some(t => prospect.title?.toLowerCase().includes(t.toLowerCase()))) matched += weights.titles
     }
     if (criteria.company_sizes?.length) {
       total += weights.company_sizes
       if (criteria.company_sizes.includes(prospect.company_size ?? '')) matched += weights.company_sizes
     }
     if (criteria.geographies?.length) {
       total += weights.geographies
       if (criteria.geographies.includes(prospect.country ?? '')) matched += weights.geographies
     }
     if (criteria.keywords?.length) {
       total += weights.keywords
       const text = `${prospect.company_name ?? ''} ${prospect.company_description ?? ''}`.toLowerCase()
       if (criteria.keywords.some(k => text.includes(k.toLowerCase()))) matched += weights.keywords
     }
     return total > 0 ? Math.round((matched / total) * 100) / 100 : 0
   }
   ```

5. UPSERT all prospects into `prospects` table (INSERT ... ON CONFLICT (org_id, linkedin_url) DO UPDATE or use email as dedup key)
6. Set `enrichment_source` to the first step that provided primary data
7. Store `enrichment_data` (raw API response) — EXCEPT for `web_scrape` and `apify_linkedin` sources where only normalised fields are stored
8. Returns `{prospects: Prospect[], total: number, enrichment_sources_used: string[]}`

---

## PART 3 — personalise Edge Function

Create `supabase/functions/personalise/index.ts`. POST — any authenticated org member.

### Input: `{prospect_id: string, job_id: string, platform?: string}`

### Logic (spec Section 5 personalise):
1. Extract `org_id` from JWT
2. Fetch `prospect WHERE id = $prospect_id AND org_id = $org_id` — verify org ownership
3. Fetch `generation_jobs WHERE id = $job_id AND org_id = $org_id` — the approved asset
4. Fetch `brand_contexts WHERE org_id = $org_id` — brand voice
5. Resolve text model: `org_model_preferences` for `step_key = 'outreach_copy'` → fall back to `available_models` default (`gemini-3-flash-preview`)
6. Query `org_slug` from orgs
7. Build the personalisation prompt:
   ```
   You are writing a personalised B2B outreach message for {company_name} (brand).
   Target platform: {platform ?? 'linkedin'}

   Brand voice:
   - Tone: formal/conversational={tone_formal_conversational}, bold/safe={tone_safe_bold}
   - Emoji usage: {emoji_usage}
   - CTA style: {cta_style}
   - Example voice: "{voice_examples[0]}"

   The campaign is about: {content_job.signal_headline}
   Generated asset: {asset_type} titled "{content_job.prompt_tags.subject}"

   Prospect:
   - Name: {first_name} {last_name}, {title} at {company_name}
   - Company: {company_name} — {company_description}
   - Industry: {industry}, Size: {company_size}, Country: {country}

   Write a personalised outreach message for {platform}. Max 200 words. 
   Reference the prospect's company context. Reference the campaign asset.
   Use the brand voice. End with the CTA style: {cta_style}.
   Do NOT mention: {competitor_names.join(', ')}
   ```
8. Call the resolved text provider via `_shared/providers/router.ts routeTextGeneration(providerKey, modelId, messages, apiKey, orgId, orgSlug, null, 'outreach_copy')`
9. INSERT into `outreach_copies`: prospect_id, job_id, copy_text, platform, status='draft'
10. Returns `{copy_text, copy_id}`

Add `routeTextGeneration` to router.ts if not already present — dispatches text prompts to the correct provider adapter.

---

## PART 4 — generate-campaign-brief Edge Function

Create `supabase/functions/generate-campaign-brief/index.ts`. POST — any authenticated org member.

### Input: `{job_id: string, prospect_ids: string[]}`

### WARNING from spec: `@react-pdf/renderer` in Deno — import via `npm:@react-pdf/renderer`. Test locally with Supabase CLI before deploying. If Deno incompatibility, fall back to `pdf-lib` (`npm:pdf-lib`).

### Logic:
1. Extract `org_id` from JWT
2. Fetch `generation_jobs WHERE id = $job_id`
3. Fetch `brand_contexts WHERE org_id = $org_id`
4. Fetch approved `outreach_copies WHERE org_id = $org_id AND job_id = $job_id AND prospect_id IN $prospect_ids AND status = 'approved'`
5. Resolve text model for `step_key = 'campaign_brief'`
6. Query `org_slug` from orgs

7. Generate brief content via AI:
   ```typescript
   const briefPrompt = `
   Create a 14-day campaign brief for the following B2B marketing campaign:
   Company: ${brand_contexts.company_name}
   Campaign asset: ${job.asset_type} — ${job.prompt_tags.subject}
   Trend: ${job.content_job_json.signal_headline}
   Primary platform: ${brand_contexts.primary_platform}
   Secondary platform: ${brand_contexts.secondary_platform}
   Timezone: ${brand_contexts.timezone}
   Posts per week: ${brand_contexts.posts_per_week}
   
   Generate:
   1. posting_schedule: array of 14 days with recommended_date, platform, time_utc, time_local (in timezone)
   2. caption_variants: {primary_platform: [3 caption options], secondary_platform: [3 caption options]}
   3. hashtag_sets: {general: [10 hashtags], regional: [5 region-specific hashtags]}
   4. timing_recommendations: best posting times per platform for ${brand_contexts.country_code} timezone audience
   
   Return as valid JSON matching this structure exactly.
   `
   const briefData = await callTextProvider(briefPrompt, ...)
   ```

8. Generate PDF using `@react-pdf/renderer`:
   ```typescript
   import { Document, Page, Text, View, StyleSheet, renderToBuffer } from 'npm:@react-pdf/renderer'
   
   const BriefDocument = () => (
     <Document>
       <Page style={styles.page}>
         <View style={styles.header}><Text style={styles.title}>Campaign Brief — {brand.company_name}</Text></View>
         <View style={styles.section}><Text style={styles.heading}>14-Day Posting Schedule</Text>
           {brief.posting_schedule.map(day => <Text key={day.recommended_date}>{day.recommended_date}: {day.time_local} on {day.platform}</Text>)}
         </View>
         <View style={styles.section}><Text style={styles.heading}>Caption Variants — {brand.primary_platform}</Text>
           {brief.caption_variants.primary_platform.map((c, i) => <Text key={i}>Option {i+1}: {c}</Text>)}
         </View>
         <View style={styles.section}><Text style={styles.heading}>Hashtags</Text>
           <Text>General: {brief.hashtag_sets.general.join(' ')}</Text>
           <Text>Regional: {brief.hashtag_sets.regional.join(' ')}</Text>
         </View>
       </Page>
     </Document>
   )
   const pdfBuffer = await renderToBuffer(<BriefDocument />)
   ```
   > If `renderToBuffer` fails in Deno, fall back to `pdf-lib`: `import {PDFDocument, rgb} from 'npm:pdf-lib'` and build a simpler layout.

9. Save PDF to Storage: `briefs/{org_id}/{brief_id}.pdf` using service role client
10. INSERT into `campaign_briefs`: job_id, brief_data, pdf_url=storagePath
11. Returns `{brief_id, pdf_url}` — NOT the direct storage URL. Frontend calls Edge Function for signed URL.

---

## PART 5 — /icp Page

Create `apps/web/app/(dashboard)/icp/page.tsx` and `apps/web/components/icp/`.

### ICP criteria form (spec Section 12.1):
- Target industries — multi-select (same options as onboarding Section 1)
- Target company sizes — multi-select: SMB | Mid-market | Enterprise
- Target geographies — country multi-select
- Target job titles — tag input (up to 10)
- Company keywords — tag input (words in company name/description)
- Specific domains — textarea (one domain per line)
- **Pre-populate** from `brand_contexts.last_icp_criteria` if not null
- 'Enrich' button → calls icp-enrich Edge Function. Shows loading state.
- **Rescore button** — shown when current form values differ from `last_icp_criteria`. Calls icp-enrich with `rescore_only: true` flag (skip waterfall, just recompute icp_score with new criteria). This avoids burning free-tier API quota.

### Prospect table:
- Columns: Name, Title, Company, Industry, Country, Enrichment Source badge, ICP Score badge (green ≥0.7 / amber 0.4-0.69 / grey <0.4), Status badge
- Sortable by icp_score (default: DESC), company_name, country
- Row click → navigate to `/icp/{prospect_id}/personalise`
- Missing-field warnings: if key fields are null (email, company_description), show warning icon with tooltip 'Email not found — enrichment incomplete'
- Partially enriched badge: 'Partial data' badge on rows where critical fields are null

### Bulk CSV export button (above table):
- Shown when ≥1 prospect has `status = 'approved'` outreach copy
- Client-side CSV generation (no Edge Function needed):
  ```typescript
  const approvedProspects = prospects.filter(p => p.status === 'outreach_drafted')
  const csvRows = [['first_name', 'last_name', 'email', 'company_name', 'platform', 'copy_text', 'icp_score']]
  // ... add rows
  const csv = csvRows.map(r => r.join(',')).join('\n')
  const blob = new Blob([csv], {type: 'text/csv'})
  // trigger download
  ```

### Pre-select job for campaign (URL param `?job_id={id}`):
- When coming from /create/[job_id] via 'Use for campaign' button, the job_id is pre-selected for outreach and brief generation

---

## PART 6 — /icp/[prospect_id]/personalise Page

Create `apps/web/app/(dashboard)/icp/[prospect_id]/personalise/page.tsx`.

### Layout — two panels:

**Left: Prospect sidebar (spec Section 11.8):**
- Name, title, company_name
- Enrichment source badge
- ICP score badge
- Missing-field warnings

**Right: Outreach copy area:**
- Platform selector dropdown (LinkedIn message | Email | Cold DM)
- If no copy exists: large 'Generate' button — calls personalise Edge Function. Shows loading.
- If copy exists: shows current copy_text in a shadcn Textarea (editable)
  - On textarea blur: PATCH to `outreach_copies.copy_text` via Supabase client (direct, status stays 'draft')
  - **Approve button**: sets `status = 'approved'`. Textarea becomes read-only. 'Approved' badge shown. Sets all other 'approved' copies for this prospect to 'draft' first.
  - 'Regenerate' button: calls personalise Edge Function again. Inserts new row, does NOT overwrite.

**Copy to clipboard button (appears when approved):**
- `navigator.clipboard.writeText(copy_text)` → 'Copied!' toast for 2 seconds
- Updates status to 'exported' via Supabase client PATCH

**Empty state:** 'No copy generated yet. Click Generate to create personalised outreach for this prospect.'

---

## PART 7 — /campaigns Page

Create `apps/web/app/(dashboard)/campaigns/page.tsx`.

- Fetch `campaign_briefs WHERE org_id = $org_id ORDER BY created_at DESC`
- Each brief card:
  - Company name + campaign job subject
  - Created date
  - 'View PDF' button — fetches signed URL from Supabase Storage (1-hour expiry), opens in new tab
  - 'Download PDF' button — same signed URL, `download` attribute
- Empty state: 'No campaign briefs yet. Generate your first brief from the /icp page.'

Signed URL generation (Edge Function or Supabase client with service role):
```typescript
// In page (server component) or via Edge Function:
const {data: signedUrl} = await supabase.storage.from('briefs').createSignedUrl(brief.pdf_url, 3600)
```

Install shadcn: `npx shadcn@latest add table data-table`

---

## PART 8 — Verification

**End-of-week test (spec Section 17 Week 5 — full pilot flow):**
1. Complete onboarding (if not done)
2. Go to /dashboard — select a trend signal
3. Generate an image asset at /create — view at /create/[job_id] — rate it 5 stars — click 'Use for campaign'
4. Redirected to /icp with job pre-selected
5. Fill ICP criteria (set 2–3 industries, 2 titles, 1 geography)
6. Click 'Enrich' — wait for waterfall to complete
7. Prospect table shows enriched prospects with icp_score badges and enrichment_source badges
8. Click highest-scored prospect → /icp/[id]/personalise
9. Click 'Generate' — personalised outreach copy appears
10. Edit copy, click 'Approve', click 'Copy to clipboard'
11. Navigate back to /icp — click 'Generate brief'
12. Brief generated — navigate to /campaigns
13. Click 'Download PDF' — PDF downloads with posting schedule, captions, hashtags
14. Check `get_logs` on icp-enrich, personalise, generate-campaign-brief — no errors
