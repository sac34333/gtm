# GTM Engine — Brand Assets

**Org:** GTM - Qubitly Ventures (`2991f549-464f-49fb-89de-69a1a2319e9e`)
**Purpose:** Dogfooding — launching GTM Engine on LinkedIn using GTM Engine itself

---

## 1. Brand Guidelines (Text for AI Prompts)

This text gets fed into `build-prompt`, `generate-captions`, `personalise`, and `generate-campaign-brief` as `brand_guidelines_text`. It shapes how the AI writes, designs, and positions GTM Engine across every output.

---

### Brand Voice

GTM Engine speaks like a senior marketer who actually ships work — not a consultant who writes frameworks. We are direct, confident, slightly provocative, and never waste a word. We lead with outcomes, not features. We use data when it earns trust, and story when it earns attention.

**We are:** Direct, confident, human, bold, data-smart
**We are not:** Corporate, fluffy, generic, hedging, jargon-heavy

**Tone axes (already set in brand context):**
- Conversational: 62% — we talk like a colleague, not a brochure
- Bold: 68% — we make strong claims and back them up
- Human: 75% — warmth over polish, real examples over abstract concepts
- Data-driven: 55% — we use numbers to earn trust, not to overwhelm
- Provocative: 60% — we challenge assumptions, but with respect

### Writing Rules

1. **Lead with the outcome, not the tool.** "Ship a campaign in one sitting" not "Our platform has campaign management features."
2. **Short sentences.** Average 12–15 words. Break complex ideas into two sentences rather than one long one.
3. **Active voice only.** "We find your ICP" not "Your ICP is found by our system."
4. **No fluff words.** Never use: revolutionary, game-changing, cutting-edge, next-generation, seamless, empower, leverage (as a verb), synergize, utilisation, best-in-class. These are on our banned list for a reason.
5. **Specificity over superlatives.** "12 data sources scored in 15 minutes" not "powerful AI-driven insights."
6. **Challenge the status quo.** Address the pain directly. "Most B2B teams spend 3 days researching before writing one post. GTM Engine does it in 15 minutes."
7. **Competitive but not petty.** We name the pain we solve. We can reference the landscape ("6 tools for what should be 1 job") without mocking competitors by name in ad copy.
8. **One idea per sentence.** One idea per post paragraph. If a sentence has a comma-list, consider breaking it up.
9. **CTAs are direct.** "Try it free" not "Discover how our innovative platform can help you achieve your marketing goals."
10. **Global audience awareness.** Avoid US-centric idioms. Avoid India-only references unless explicitly targeting India. Write for a reader in Singapore, Dubai, Lagos, São Paulo, or London — not just San Francisco.

### Visual Identity Rules

**Colour usage:**
- Primary Indigo (#6366f1): Headlines, primary CTAs, accent borders
- Accent Cyan (#06b6d4): Data callouts, secondary highlights, icon fills
- Dark Base (#0f172a): Backgrounds, body text on light surfaces
- White: Card backgrounds, body text on dark surfaces
- Never use more than 2 brand colours in one asset. Neutral greys fill the gaps.

**Typography:**
- Headlines: Bold, tight tracking, maximum 5 words when possible
- Body: Regular weight, generous line height (1.6x), short paragraphs
- Never use decorative, script, or Comic Sans-type fonts

**Imagery:**
- Dark backgrounds preferred (matching our app UI)
- Abstract geometric patterns, data visualisations, and gradient overlays over photos
- Human faces: real people working, presenting, reviewing data — not stock handshakes or people pointing at laptops
- Avoid: stock corporate photos, clipart, generic office settings, people pointing at screens
- When showing the product: use real UI screenshots, not mockups

**Logo usage:**
- Minimum padding: 2x the logo height on all sides
- Never stretch, rotate, or recolour the logo
- On dark backgrounds: use the full-colour or white variant only
- On light backgrounds: use the full-colour or dark variant only

### Social Media Specific Rules

**LinkedIn:**
- Posts: 150–200 words for reach, 800–1200 for thought leadership
- Hook in the first 2 lines (before "see more")
- Use line breaks for readability
- Hashtags: 3–5, always include #GTMEngine + industry tags
- Never start with "I'm excited to announce" — start with the insight

**Twitter/X:**
- 1 idea per tweet. Thread for complexity.
- Hashtags: 1–2 maximum
- No LinkedIn-style paragraph spacing

**Instagram:**
- Visual-first. The image is the message; the caption is the context.
- Hashtags: 10–15 in the first comment, not the caption

### Banned Phrases & Topics (already in brand context, reinforcing here)

**Never say:** guaranteed results, 100% success, revolutionary, game-changing, magic, cutting-edge, next-generation, seamless, empower, leverage (as verb), synergize, best-in-class

**Never discuss:** politics, recruitment, religion, personal finance advice

**Never show:** stock corporate handshakes, generic "business people in meeting" imagery, clipart

---

## 2. Differentiators (5 entries, max 5 allowed)

Each differentiator should be a short, punchy statement about why GTM Engine wins vs alternatives.

1. **One loop, not five tools** — Signals, content, ICP, campaigns, and publishing in a single workspace. HubSpot, Clay, Apollo, Canva, and Hootsuite each do one piece. We do the whole loop.
2. **No prompt engineering required** — Pick a tag, pick a tone, generate. The AI reads your brand context, your ICP, and your signals so you never stare at a blank prompt box.
3. **Live signals, not static lists** — Data refreshes every 15 minutes from 12+ sources, scored against your business themes. Not a CSV you uploaded last quarter.
4. **Per-prospect outreach, not mail merge** — Every copy is written for a specific person, grounded in their ICP score and your campaign brief. Not a template with {first_name} swapped in.
5. **$49/mo vs $890/mo** — Starter plan gives you 50 images, 5 videos, ICP enrichment, and campaign briefs. The competition charges $890/mo for a fraction of this.

---

## 3. Proof Points (5 entries, max 5 allowed)

Each proof point should be a specific, verifiable claim or outcome that backs up your differentiators.

1. **12+ signal sources scored in under 15 minutes** — Hacker News, Product Hunt, Reddit, RSS, Tavily, Brave Search, NewsAPI, YouTube, GitHub, GDELT, and more — all ingested, scored, and ranked against your business themes.
2. **Full campaign brief with per-prospect copy in under 60 seconds** — From a blank campaign to a PDF brief + 15 personalised outreach messages in the time it takes to make coffee.
3. **5 million+ keywords and trends processed monthly** — Our signal pipeline processes headlines, summaries, and metadata across every enabled source, scoring each one for relevance to your specific business.
4. **ICP enrichment with real prospecting, not a scraped list** — Perplexity Sonar finds actual decision-makers at real companies, enriched with LinkedIn data, job titles, and company info, scored 0–100 against your criteria.
5. **Built by Qubitly Ventures — a deeptech IT company shipping AI-native products** — Not a marketing agency selling theories. We build what we sell, and we sell what we use.

---

## How to Apply

### Differentiators & Proof Points
Go to **Settings → Brand → Section: Company Identity** (step 1) or the expandable "Differentiators" card. Enter each item above.

### Brand Guidelines
Option A: Save the text above as the `brand_guidelines_text` field directly (I can do this via the save-onboarding API).

Option B: Create a PDF document with the content above and upload it in **Settings → Brand → Compliance & Guardrails** section.

Option A is recommended because the text gets injected directly into prompts. If you upload a PDF, the system extracts the text — but you get more control by editing the text field directly.