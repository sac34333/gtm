---
description: "Use when building ANY Next.js page, component, or layout for GTM Engine. Defines the complete design system: colors, typography, layout, component patterns, loading states, empty states, and mobile strategy. Apply alongside nextjs-frontend.instructions.md."
applyTo: "apps/web/**"
---

# GTM Engine — UI Design System

## Design Philosophy

**Dark mode, clean, professional, data-dense but not overwhelming.**
Non-technical marketing professionals are the primary users — every interaction must feel guided and confident, never technical. Favour clarity over cleverness. Show progress. Explain what's happening.

---

## 1. Color System

Use CSS variables defined in `app/globals.css` via `npx shadcn@latest init` with the `dark` theme. Extend with these custom tokens:

```css
/* app/globals.css — :root (light fallback, not primary) */
:root {
  --background: 222 47% 6%;          /* slate-950 */
  --foreground: 210 40% 95%;
  --card: 222 47% 9%;                /* slate-900 */
  --card-foreground: 210 40% 95%;
  --popover: 222 47% 9%;
  --popover-foreground: 210 40% 95%;
  --primary: 238 84% 67%;            /* indigo-500 */
  --primary-foreground: 0 0% 100%;
  --secondary: 222 47% 12%;
  --secondary-foreground: 210 40% 95%;
  --muted: 217 33% 15%;
  --muted-foreground: 215 20% 55%;   /* slate-400 */
  --accent: 238 84% 67%;
  --accent-foreground: 0 0% 100%;
  --destructive: 0 72% 51%;          /* red-600 */
  --destructive-foreground: 0 0% 100%;
  --border: 217 33% 18%;             /* slate-800 */
  --input: 217 33% 18%;
  --ring: 238 84% 67%;
  --radius: 0.5rem;
}
```

### Semantic colour map — use these tailwind classes everywhere

| Purpose | Class | Hex |
|---|---|---|
| Page background | `bg-slate-950` | #0a0f1e |
| Card / panel surface | `bg-slate-900` | #0f172a |
| Elevated card (hover/selected) | `bg-slate-800` | #1e293b |
| Border | `border-slate-800` | #1e293b |
| Subtle border | `border-slate-700/50` | — |
| Primary text | `text-slate-100` | #f1f5f9 |
| Secondary text | `text-slate-400` | #94a3b8 |
| Disabled text | `text-slate-600` | #475569 |
| Primary action | `bg-indigo-600 hover:bg-indigo-500` | — |
| Destructive | `bg-red-600 hover:bg-red-500` | — |
| Success | `text-emerald-400 / bg-emerald-500/10` | — |
| Warning | `text-amber-400 / bg-amber-500/10` | — |
| Error | `text-red-400 / bg-red-500/10` | — |

### Relevance score badge colours (used on signal cards)

```tsx
const relevanceBadge = (score: number) =>
  score >= 0.7 ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' :
  score >= 0.4 ? 'bg-amber-500/15 text-amber-400 border-amber-500/30' :
                 'bg-slate-500/15 text-slate-400 border-slate-500/30'
```

### ICP score badge colours (same threshold, same pattern)

```tsx
const icpBadge = (score: number) =>
  score >= 0.7 ? 'bg-emerald-500/15 text-emerald-400' :
  score >= 0.4 ? 'bg-amber-500/15 text-amber-400' :
                 'bg-slate-500/15 text-slate-400'
```

---

## 2. Typography

Install **Inter** via `next/font/google`. Apply globally in `app/layout.tsx`:

```tsx
import { Inter } from 'next/font/google'
const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })
// <html className={`${inter.variable} font-sans dark`}>
```

### Type scale — use these classes exactly

| Use | Class |
|---|---|
| Page title (h1) | `text-2xl font-semibold text-slate-100` |
| Section title (h2) | `text-lg font-semibold text-slate-100` |
| Card title | `text-base font-medium text-slate-100` |
| Label / caption | `text-sm font-medium text-slate-400` |
| Body | `text-sm text-slate-300` |
| Helper / disclaimer | `text-xs text-slate-500` |
| Code / JSON | `font-mono text-xs text-slate-300 bg-slate-800 rounded px-1.5 py-0.5` |

**Never** use `text-white` — always `text-slate-100`. Never use raw `text-gray-*` — always use `text-slate--*`.

---

## 3. Layout — App Shell

```
┌──────────────────────────────────────────────────────────┐
│  SIDEBAR (240px fixed, collapsible to 56px on mobile)    │
│  Logo | Nav items | Upgrade badge at bottom              │
├──────────────────────────────────────────────────────────┤
│  HEADER (56px, sticky)                                   │
│  Page title       │  Usage meter  │  User avatar menu   │
├──────────────────────────────────────────────────────────┤
│  MAIN CONTENT                                            │
│  max-w-7xl mx-auto px-6 py-8                            │
│  (pages wider than 7xl: px-4 on mobile, px-8 on lg+)   │
└──────────────────────────────────────────────────────────┘
```

### Sidebar implementation

```tsx
// components/layout/Sidebar.tsx
// Desktop: fixed left, 240px wide, full height, bg-slate-900 border-r border-slate-800
// Mobile: hidden by default, slide-in Sheet (shadcn Sheet component) triggered by hamburger icon

const navItems = [
  { label: 'Dashboard',  href: '/dashboard',  icon: TrendingUpIcon },
  { label: 'Create',     href: '/create',     icon: SparklesIcon },
  { label: 'ICP',        href: '/icp',        icon: UsersIcon },
  { label: 'Campaigns',  href: '/campaigns',  icon: FileTextIcon },
  { label: 'Settings',   href: '/settings',   icon: SettingsIcon },
]
// Active item: bg-indigo-600/20 text-indigo-400 border-r-2 border-indigo-500
// Inactive item: text-slate-400 hover:bg-slate-800 hover:text-slate-100
```

### Usage meter (Header — always visible)

```tsx
// components/layout/UsageMeter.tsx
// Always present in the top header. Pull from Zustand org.store.ts.
// Format: Images: 12 / 50  ·  Videos: 2 / 5
// When >= 90% used: number turns amber-400 with warning tooltip
// When at limit: number turns red-400, clicking opens upgrade modal
```

---

## 4. Card and Panel Patterns

### Standard card

```tsx
<div className="rounded-lg border border-slate-800 bg-slate-900 p-6">
```

### Elevated card (hover states, selected items)

```tsx
<div className="rounded-lg border border-slate-700 bg-slate-800/50 p-6">
```

### Signal card (dashboard)

```tsx
// Source icon (16x16) + source name + time-ago on same line
// Headline: text-base font-medium text-slate-100 (2 lines max, line-clamp-2)
// Summary: text-sm text-slate-400 (3 lines max, line-clamp-3)
// Footer row: relevance badge | matched themes chips | [Use trend] button | [Dismiss] icon button
// Hover: border-slate-700 bg-slate-800/40 transition-colors
// Dismissed: opacity-50, Restore button visible
```

### Provider / API key card

```tsx
// Header: provider logo (24px) + provider name + status badge
// Status badge: 'Key set' = emerald | 'Platform key' = amber | 'Not configured' = slate
// Body: masked input (type=password) + Save + Delete buttons
// Footer: 'Your key is AES-256-GCM encrypted...' in text-xs text-slate-500
```

---

## 5. Form Patterns

### Field anatomy

```tsx
<div className="space-y-1.5">
  <Label className="text-sm font-medium text-slate-300">
    Field Label <span className="text-red-400">*</span>  {/* * = required */}
  </Label>
  <Input
    className="bg-slate-800 border-slate-700 text-slate-100
               placeholder:text-slate-500
               focus:ring-indigo-500 focus:border-indigo-500"
  />
  <p className="text-xs text-slate-500">Helper text explaining what to enter</p>
  {/* Error state: */}
  <p className="text-xs text-red-400">This field is required</p>
</div>
```

### Error state on input

```tsx
// Add to Input className when error exists:
'border-red-500/60 focus:ring-red-500 bg-red-500/5'
```

### Form section grouping

```tsx
<div className="space-y-6">
  <div>
    <h3 className="text-base font-semibold text-slate-100">Section Title</h3>
    <p className="text-sm text-slate-400 mt-1">One sentence describing this section.</p>
  </div>
  <Separator className="bg-slate-800" />
  <div className="space-y-4">
    {/* fields */}
  </div>
</div>
```

### Multi-step wizard (onboarding)

```tsx
// Progress bar at very top of page — full width, outside card
// 'Step 2 of 5 — Brand Voice and Tone' label above bar
// Bar: bg-slate-800 track, bg-indigo-600 fill, h-1.5 rounded-full
// Card below: max-w-2xl mx-auto bg-slate-900 rounded-xl border border-slate-800
// Navigation: Back button (ghost variant) + Next/Save button (primary) in card footer
// 'Your progress is saved automatically.' in text-xs text-slate-500 below buttons
```

### Tone sliders (Section 2 of onboarding)

```tsx
// shadcn Slider component — each slider shows both pole labels
// Layout: [Label Left]  ————●————  [Label Right]
// Current value shown as a small badge above the thumb
// On mobile: full-width sliders stacked, poles above/below (not side-by-side)
```

---

## 6. Loading States

**Rule: every async data fetch must show a skeleton, never a blank screen.**

### Page-level skeleton pattern

```tsx
// Use Suspense in every (dashboard) route page with a skeleton fallback
// Skeletons match the exact layout of the real content to avoid layout shift

// Signal card skeleton:
<div className="rounded-lg border border-slate-800 bg-slate-900 p-6 space-y-3">
  <Skeleton className="h-4 w-24 bg-slate-800" />   {/* source + time */}
  <Skeleton className="h-5 w-full bg-slate-800" />  {/* headline line 1 */}
  <Skeleton className="h-5 w-3/4 bg-slate-800" />  {/* headline line 2 */}
  <Skeleton className="h-4 w-full bg-slate-800" />  {/* summary */}
  <Skeleton className="h-4 w-2/3 bg-slate-800" />
  <div className="flex gap-2 pt-2">
    <Skeleton className="h-6 w-16 rounded-full bg-slate-800" /> {/* badge */}
    <Skeleton className="h-6 w-20 rounded-full bg-slate-800" />
  </div>
</div>
```

### Inline loading (button submitting)

```tsx
<Button disabled={isLoading}>
  {isLoading ? (
    <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</>
  ) : 'Save Changes'}
</Button>
// Always disable the button AND show a spinner — never just grey it out silently
```

### Generation in progress (image — /create page)

```tsx
// Replaces the result area while polling:
<div className="aspect-square rounded-lg border border-slate-800 bg-slate-900
                flex flex-col items-center justify-center gap-4">
  <div className="h-12 w-12 rounded-full border-2 border-indigo-500
                  border-t-transparent animate-spin" />
  <p className="text-sm text-slate-400">Generating your image...</p>
  <p className="text-xs text-slate-500">Usually takes 15–30 seconds</p>
</div>
```

### Video job submitted state (/dashboard card)

```tsx
// A distinct 'in-progress' card variant in the signal feed area:
// Animated gradient border: border-indigo-500/50
// Icon: Video camera with pulse animation
// Text: 'Your video is being generated...'
// Progress: 'Started 2 min ago' + spinner
// Realtime subscription updates this card when job completes
```

---

## 7. Empty States

**Every list, table, and feed must have a defined empty state. Never show a blank area.**

### Template

```tsx
<div className="flex flex-col items-center justify-center py-16 text-center">
  <div className="rounded-full bg-slate-800 p-4 mb-4">
    <Icon className="h-8 w-8 text-slate-500" />
  </div>
  <h3 className="text-base font-semibold text-slate-100 mb-1">Empty state title</h3>
  <p className="text-sm text-slate-400 max-w-sm mb-6">
    Friendly explanation of why it's empty and what to do.
  </p>
  <Button>Primary action</Button>  {/* optional */}
</div>
```

### Defined empty states per page

| Page | Icon | Title | Message | Action |
|---|---|---|---|---|
| /dashboard — no signals yet | TrendingUp | 'Your signals will appear soon' | 'We're scanning your configured sources. First signals arrive within 15 minutes.' | None |
| /dashboard — all dismissed | Inbox | 'All caught up' | 'No new signals. Check back soon, or add more sources in Settings.' | 'Add sources' → /settings |
| /icp — no prospects | Users | 'No prospects enriched yet' | 'Define your ICP criteria and click Enrich to discover matching prospects.' | None |
| /campaigns — no briefs | FileText | 'No campaign briefs yet' | 'Generate your first brief from the ICP page once you have approved outreach copy.' | None |
| /settings/usage — no data | BarChart2 | 'No usage recorded yet' | 'Generate an image or run outreach copy to see your AI usage here.' | None |

---

## 8. Toast / Notification System

Use **Sonner** (`sonner` package, shadcn's recommended toaster):

```tsx
// app/layout.tsx — add once:
import { Toaster } from 'sonner'
// <Toaster position="bottom-right" theme="dark" richColors />

// Usage anywhere:
import { toast } from 'sonner'
toast.success('Settings saved')
toast.error('Failed to save. Please try again.')
toast.info('Fetching signals...')
toast.loading('Generating your image...')  // dismiss manually when done
```

### Toast rules

- **Success:** always show for user-initiated saves and actions
- **Error:** always show with a brief human-readable reason (not "Error 500")
- **Info:** use for long-running operations start (ingest triggered, generation submitted)
- **Duration:** success = 3s, error = 5s, info = 4s
- **Never** show raw error messages from the API (`error.message`) — map to friendly strings

---

## 9. Responsive / Mobile Strategy

**Mobile breakpoints are mandatory, not optional.** Non-tech users will access on phones.

| Element | Mobile (< md) | Desktop (md+) |
|---|---|---|
| Sidebar | Hidden, hamburger in header opens Sheet | Fixed 240px left |
| Page padding | `px-4 py-6` | `px-6 py-8` |
| Signal cards | Full-width stacked | Grid 2-col on xl |
| Onboarding card | Full-width, no max-w | `max-w-2xl mx-auto` |
| Tone sliders | Stacked, labels above/below | Side-by-side labels |
| Data tables | Horizontal scroll container | Full-width |
| Model selector | Full-screen modal | Inline dropdown |
| Tag editor form | Single column | Two column grid |
| Generation result | Image 100% width, controls below | Side-by-side |

### Responsive utility pattern

```tsx
// Sidebar mobile sheet:
<Sheet>
  <SheetTrigger asChild>
    <Button variant="ghost" size="icon" className="md:hidden">
      <Menu className="h-5 w-5" />
    </Button>
  </SheetTrigger>
  <SheetContent side="left" className="w-64 bg-slate-900 border-slate-800 p-0">
    <SidebarContent />
  </SheetContent>
</Sheet>
// Sidebar desktop:
<aside className="hidden md:flex fixed left-0 top-0 h-full w-60
                  flex-col bg-slate-900 border-r border-slate-800 z-40">
  <SidebarContent />
</aside>
```

---

## 10. Button Hierarchy

```tsx
// Primary — indigo fill. One per major action per screen.
<Button>Generate</Button>              // bg-indigo-600 hover:bg-indigo-500

// Secondary / outline — for less-important actions
<Button variant="outline">            // border-slate-700 bg-transparent hover:bg-slate-800

// Ghost — for icon buttons, nav items, cancel
<Button variant="ghost">Dismiss</Button>

// Destructive — delete, remove actions
<Button variant="destructive">Delete Key</Button>

// Link — navigation, breadcrumbs
<Button variant="link">Reset to default</Button>

// Size rules:
// Default (h-10): form submits, modal confirmations
// sm (h-8): card actions, table actions, secondary buttons within cards
// icon (h-10 w-10): icon-only buttons (dismiss, copy, delete)
```

---

## 11. Badge / Status Chip Patterns

```tsx
// Status badges — use inline with border for definition:
<span className="inline-flex items-center rounded-full border px-2.5 py-0.5
                 text-xs font-medium [apply colour classes from §1]">
  Label
</span>

// Plan tier badge (sidebar / billing):
// starter = slate  |  growth = indigo  |  scale = purple  |  fully_subscribed = emerald

// Role badge (team table):
// owner = amber  |  admin = indigo  |  member = slate

// Enrichment source badge (prospect table):
// pdl = blue  |  apollo = orange  |  hunter = green  |  clearbit = cyan  |  web_scrape = slate

// Key status badge (provider cards):
// 'Org key set' = emerald  |  'Platform key' = amber  |  'Not configured' = slate/red
```

---

## 12. Data Tables

Use **shadcn DataTable** (built on TanStack Table). Standard structure:

```tsx
// Header: Title (left) + [action buttons right — e.g. Export CSV, Invite]
// Table: bg-slate-900 border border-slate-800 rounded-lg overflow-hidden
// Header row: bg-slate-800/50 text-xs font-medium text-slate-400 uppercase tracking-wider
// Data rows: border-t border-slate-800, hover:bg-slate-800/30
// Empty state: colspan full-width empty state component (see §7)
// Pagination: bottom right, slate-400 text
// On mobile: overflow-x-auto wrapper around table
```

---

## 13. Modal and Dialog Patterns

Use **shadcn Dialog**. Rules:

```tsx
// Max width: max-w-md for confirmations, max-w-2xl for forms, max-w-4xl for model selector
// Background overlay: bg-black/60 backdrop-blur-sm
// Dialog panel: bg-slate-900 border border-slate-800 rounded-xl

// Upgrade modal (when quota reached):
// Icon: large SparklesIcon in amber circle
// Title: 'You've reached your [image/video] limit'
// Body: current plan usage + next plan benefits
// CTA: 'Upgrade plan' (primary indigo) | 'Cancel' (ghost)

// Destructive confirmation modal:
// Title: 'Delete [item]?'  
// Body: 'This action cannot be undone.'
// Buttons: 'Cancel' (outline) | 'Delete' (destructive) — Delete always on right
```

---

## 14. Settings Page Layout Pattern

All `/settings/*` pages share this layout:

```tsx
// Left: vertical tab list (stacked nav links)
// - Settings (data sources)
// - Models
// - Usage
// - Team
// - Billing
// On mobile: horizontal scrolling tab bar instead
// Right: content panel with page title + description at top
// Member read-only: all inputs have disabled prop + tooltip on hover
// 'Contact your admin to change this setting.'
```

---

## 15. Micro-copy and Tone Rules

Non-tech users read these words. They must be clear, human, and reassuring.

| Context | Write | Not |
|---|---|---|
| Save button | 'Save changes' | 'Submit', 'Update', 'Confirm' |
| Loading | 'Generating your image...' | 'Processing request...' |
| Empty signals | 'Your signals will appear soon' | 'No data found' |
| Quota warning | 'You've used 45 of 50 images this month' | 'Quota 90% consumed' |
| API key saved | 'Key saved — we'll use it for all future requests' | 'Record updated' |
| Error generic | 'Something went wrong. Please try again.' | 'Internal server error 500' |
| Locked feature | 'Contact your admin to change this setting.' | 'Insufficient permissions' |
| Invite sent | 'Invite sent to email@company.com' | 'User created' |
| Onboarding prompt | 'What problem do you solve, for whom?' | 'Enter pitch' |

---

## 16. Accessibility Minimums

- All interactive elements must be keyboard-focusable with visible `focus-visible:ring-2 ring-indigo-500`
- All images must have `alt` text
- All icon-only buttons must have `aria-label`
- All form inputs must have associated `<Label htmlFor=...>`
- Color alone must never be the only indicator (pair color with icon or text)
- shadcn/ui components are ARIA-compliant by default — do not override their role attributes

---

## 17. Tag Card Editor Patterns (/create page)

The tag card editor is the core non-technical UX. Every prompt_tags field except Subject, CTA Text, and Additional Notes must use visual cards — never dropdowns or plain text inputs.

### Choice card (single-select)

```tsx
// components/generation/ChoiceCard.tsx
interface ChoiceCardProps {
  value: string
  label: string
  sublabel?: string
  icon?: React.ReactNode  // emoji string, lucide icon, or SVG
  selected: boolean
  onSelect: (value: string) => void
}

// Layout: rounded-lg border p-4 cursor-pointer flex flex-col items-center gap-2 text-center
// Unselected: border-slate-700 bg-slate-900 hover:bg-slate-800 hover:border-slate-600
// Selected:   border-indigo-500 bg-indigo-500/10 ring-1 ring-indigo-500
// Label: text-sm font-medium text-slate-100
// Sublabel: text-xs text-slate-400

<button
  onClick={() => onSelect(value)}
  className={cn(
    'rounded-lg border p-4 cursor-pointer flex flex-col items-center gap-2 text-center transition-colors',
    selected
      ? 'border-indigo-500 bg-indigo-500/10 ring-1 ring-indigo-500'
      : 'border-slate-700 bg-slate-900 hover:bg-slate-800 hover:border-slate-600'
  )}
  aria-pressed={selected}
>
  <span className="text-2xl">{icon}</span>
  <span className="text-sm font-medium text-slate-100">{label}</span>
  {sublabel && <span className="text-xs text-slate-400">{sublabel}</span>}
</button>
```

### Card grid layouts

```tsx
// Visual Style — 5 cards, 1 row on desktop (auto-wrap on mobile)
<div className="grid grid-cols-5 gap-3 sm:grid-cols-3">
  {VISUAL_STYLES.map(s => <ChoiceCard key={s.value} {...s} ... />)}
</div>

// Mood — 6 cards, 3×2 grid
<div className="grid grid-cols-3 gap-3">
  {MOODS.map(m => <ChoiceCard key={m.value} {...m} ... />)}
</div>

// Platform — 5 cards, horizontal scroll on mobile
<div className="grid grid-cols-5 gap-3 overflow-x-auto sm:grid-cols-3">
  {PLATFORMS.map(p => <ChoiceCard key={p.value} {...p} ... />)}
</div>

// Aspect Ratio — 4 cards, each showing a literal SVG shape preview
<div className="grid grid-cols-4 gap-3 sm:grid-cols-2">
  <ChoiceCard
    value="1:1"
    label="Square"
    icon={<svg width="32" height="32" viewBox="0 0 32 32"><rect x="2" y="2" width="28" height="28" rx="2" className="stroke-current fill-none" strokeWidth="2"/></svg>}
    ...
  />
  {/* 16:9: wide rectangle, 9:16: tall rectangle, 4:5: slightly tall */}
</div>
```

### Platform → aspect ratio auto-mapping (client-side constant)

```typescript
// apps/web/lib/platform-defaults.ts
export const PLATFORM_ASPECT_DEFAULTS: Record<string, string> = {
  linkedin:  '4:5',
  instagram: '1:1',
  twitter:   '16:9',
  whatsapp:  '1:1',
  generic:   '1:1',
}
// On platform card select: setPromptTags(prev => ({ ...prev, platform: value, aspect_ratio: PLATFORM_ASPECT_DEFAULTS[value] }))
// User can still override aspect_ratio after platform auto-sets it
```

### Colour swatch card

```tsx
// Three swatch options: 'brand' | 'vibrant' | 'monochrome' + optional 'custom' text input
<div className="flex gap-3">
  <button
    className={cn('rounded-lg border p-3 flex flex-col items-center gap-2', selected === 'brand' ? 'border-indigo-500 ring-1 ring-indigo-500' : 'border-slate-700')}
    onClick={() => handleSwatchSelect('brand')}
    aria-pressed={selected === 'brand'}
  >
    <div className="flex gap-1">
      {/* three circles using org brand_colours */}
      <div className="h-5 w-5 rounded-full" style={{ background: brandColours.primary }} />
      <div className="h-5 w-5 rounded-full" style={{ background: brandColours.secondary }} />
      <div className="h-5 w-5 rounded-full" style={{ background: brandColours.accent }} />
    </div>
    <span className="text-xs text-slate-300">Your brand</span>
  </button>
  {/* vibrant + monochrome: use static colour sets as swatches */}
</div>
// 'Custom...' link below: shows a text input when clicked — sets colour_palette free text
```

### Refinement chip pattern

```tsx
// components/generation/RefinementChips.tsx
// Multi-select pill buttons — no card border, just pill shape
const chipBase = 'inline-flex items-center rounded-full border px-3 py-1.5 text-sm cursor-pointer transition-colors'
const chipUnselected = 'border-slate-700 bg-slate-800 text-slate-300 hover:border-slate-600 hover:bg-slate-700'
const chipSelected = 'border-indigo-500 bg-indigo-500/20 text-indigo-300 ring-1 ring-indigo-500'

{REFINEMENT_CHIPS.map(chip => (
  <button
    key={chip.value}
    onClick={() => toggleChip(chip.value)}
    className={cn(chipBase, selected.includes(chip.value) ? chipSelected : chipUnselected)}
    aria-pressed={selected.includes(chip.value)}
  >
    {chip.label}
  </button>
))}
```

### Strength slider (refinement panel)

```tsx
// shadcn Slider — single value 1-5
<div className="space-y-2">
  <div className="flex justify-between text-xs text-slate-400">
    <span>Small tweak</span>
    <span>Completely new</span>
  </div>
  <Slider min={1} max={5} step={1} defaultValue={[2]}
    className="[&_[role=slider]]:bg-indigo-500"
    onValueChange={([v]) => setStrength(v)}
  />
</div>
```

### Image comparison (before/after refinement)

```tsx
// Side by side on desktop, stacked on mobile
<div className="grid grid-cols-2 gap-4 sm:grid-cols-1">
  <div className="space-y-2">
    <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Original</span>
    <img src={originalUrl} className="rounded-lg w-full" alt="Original generated image" />
    <Button variant="outline" size="sm" className="w-full" onClick={() => handleUse('original')}>Use original</Button>
  </div>
  <div className="space-y-2">
    <span className="text-xs font-medium text-indigo-400 uppercase tracking-wider">Refined ✓</span>
    <img src={refinedUrl} className="rounded-lg w-full ring-1 ring-indigo-500/50" alt="Refined generated image" />
    <Button size="sm" className="w-full" onClick={() => handleUse('refined')}>Use this one</Button>
  </div>
</div>
```

### Animated prompt preview (generation in progress)

```tsx
// Shows compiled_prompt being 'typed' while spinner runs
// Use a useEffect + setInterval to reveal characters one by one
// Cap at 120 chars for display (the full prompt is long)
const [displayedText, setDisplayedText] = useState('')
useEffect(() => {
  if (!compiledPrompt || !isGenerating) return
  const preview = compiledPrompt.slice(0, 120)
  let i = 0
  const interval = setInterval(() => {
    setDisplayedText(preview.slice(0, i++))
    if (i > preview.length) clearInterval(interval)
  }, 18) // ~18ms per char → ~2s for 120 chars
  return () => clearInterval(interval)
}, [compiledPrompt, isGenerating])

// Render below the spinner:
<p className="text-xs text-slate-400 font-mono text-center max-w-xs mx-auto line-clamp-3">
  {displayedText}<span className="animate-pulse">|</span>
</p>
```

### Signal context banner

```tsx
// components/generation/SignalBanner.tsx
// Only rendered when signal_id is present in URL params
<div className="flex items-center gap-3 rounded-lg border border-slate-700 bg-slate-800/50 px-4 py-2.5">
  <span className="text-base">📰</span>
  <span className="text-sm text-slate-300 flex-1 truncate">
    Based on: <span className="text-slate-100 font-medium">{signal.headline.slice(0, 60)}{signal.headline.length > 60 ? '…' : ''}</span>
  </span>
  <button
    className="text-xs text-indigo-400 hover:text-indigo-300 whitespace-nowrap"
    onClick={() => setDrawerOpen(true)}
  >
    View article ↗
  </button>
  <button onClick={onDismiss} aria-label="Dismiss signal context" className="text-slate-500 hover:text-slate-300">
    <X className="h-3.5 w-3.5" />
  </button>
</div>
```

### Quick-action buttons (below generated image)

```tsx
// Four icon+label buttons in a horizontal row — sm size, outline variant except Download (primary)
<div className="flex gap-2 flex-wrap">
  <Button size="sm" onClick={handleDownload}>
    <Download className="mr-1.5 h-3.5 w-3.5" /> Download
  </Button>
  <Button size="sm" variant="outline" onClick={() => setRefinePanelOpen(true)}>
    <Wand2 className="mr-1.5 h-3.5 w-3.5" /> Refine
  </Button>
  <Button size="sm" variant="outline" onClick={handleUseCampaign}>
    <Send className="mr-1.5 h-3.5 w-3.5" /> Use for campaign
  </Button>
  <Button size="sm" variant="outline" onClick={handleRegenerate}>
    <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Regenerate
  </Button>
</div>
```
