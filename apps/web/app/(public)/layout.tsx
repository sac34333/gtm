import type { Metadata } from 'next'

// Server component layout — wraps all (public) routes: /login, /signup,
// /forgot-password, /reset-password, /invite/accept.
// Client-component pages cannot export `metadata` themselves in Next.js 14,
// so we handle all SEO/AEO signals here.

export const metadata: Metadata = {
  title: 'Sign In',
  description:
    'Sign in to GTM Engine — the AI-powered go-to-market platform for B2B teams. Build campaigns, enrich prospects, generate assets, and post to LinkedIn.',
  openGraph: {
    title: 'GTM Engine — Sign In',
    description:
      'AI-powered go-to-market platform. Build campaigns, enrich B2B prospects, generate creative assets, and post to LinkedIn.',
    url: 'https://gtmengine.qubitlyventures.com/login',
  },
  alternates: {
    canonical: 'https://gtmengine.qubitlyventures.com/login',
  },
}

// FAQPage schema — the #1 GEO trigger (Google AI Overviews) and AEO signal
// (Perplexity, ChatGPT Browse). Questions are written as real search queries,
// not branded fluff. Answers are self-contained and direct.
const faqSchema = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: [
    {
      '@type': 'Question',
      name: 'What is GTM Engine?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'GTM Engine is an AI-powered go-to-market platform built for B2B marketing and sales teams. It combines campaign planning with AI brief generation, ICP prospect enrichment from multiple data providers, AI image and video generation, LinkedIn company page posting, and a conversational AI assistant that answers questions about live campaign and ad metrics. It is built by Qubitly Ventures and runs on Cloudflare Pages.',
      },
    },
    {
      '@type': 'Question',
      name: 'How does GTM Engine help B2B marketing teams run campaigns?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'GTM Engine generates structured campaign briefs using AI, including posting schedules, hashtag sets, key messages, and channel recommendations. Teams can generate images and videos directly from within a campaign, enrich ICP prospects with enrichment data, and produce personalised outreach copy for LinkedIn DM, email, and cold call — all from a single workspace.',
      },
    },
    {
      '@type': 'Question',
      name: 'Does GTM Engine integrate with LinkedIn?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Yes. GTM Engine connects to LinkedIn company pages via a 60-day access token. Once connected, you can read recent company page posts, publish new posts with or without image attachments directly from the platform, and pull live LinkedIn ad metrics into the Campaign Ask feature. The integration requires a LinkedIn developer app with the Share on LinkedIn and Marketing Developer Platform products enabled.',
      },
    },
    {
      '@type': 'Question',
      name: 'What AI models does GTM Engine use to generate content?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'GTM Engine routes AI generation tasks across multiple leading models. For image generation it uses Flux Pro via fal.ai. For video it uses Kling and other fal.ai models. For text generation (campaign briefs, outreach copy, campaign chat) it uses GPT-4o, Claude Sonnet, and Gemini Pro via OpenRouter model routing, automatically selecting the best available model based on the task and the organisation\'s preferences.',
      },
    },
    {
      '@type': 'Question',
      name: 'How does GTM Engine enrich prospect data?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'GTM Engine uses a waterfall enrichment approach across multiple providers: People Data Labs (PDL), Apollo.io, Hunter.io, and Clearbit. Each prospect in an ICP list is enriched with company size, industry, job title, LinkedIn profile, email, and other firmographic data. An ICP score (0–100) is calculated based on how well the prospect matches the organisation\'s ideal customer profile. If one provider returns incomplete data, the next provider in the waterfall fills the gaps.',
      },
    },
    {
      '@type': 'Question',
      name: 'What is the GTM Engine Ask feature?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Campaign Ask is a conversational AI assistant embedded in each campaign. It uses live data from LinkedIn ad metrics, trend signals, and the campaign brief to answer strategic questions in natural language — for example: "Which segments are performing best?", "What is my ad spend pacing this week?", or "Give me 3 LinkedIn DM openers for my top prospect." The Ask feature requires a LinkedIn connection to access live metrics.',
      },
    },
    {
      '@type': 'Question',
      name: 'Is GTM Engine secure?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'GTM Engine encrypts all third-party API keys and LinkedIn access tokens with AES-256-GCM before storing them in the database. Keys are never returned to the browser after the initial save. The platform is built on Supabase with Row-Level Security (RLS) policies enforcing organisation-level data isolation — one organisation cannot access another\'s data. All Edge Functions run in Deno on Supabase infrastructure with JWT-based authentication.',
      },
    },
    {
      '@type': 'Question',
      name: 'Who built GTM Engine?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'GTM Engine is built by Qubitly Ventures, an AI engineering company. It is a production-grade SaaS application built with Next.js 14, Supabase, and Cloudflare Pages. The platform launched in 2026.',
      },
    },
  ],
}

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
      {/* Minimal header so visitors can reach the public pages */}
      <header className="absolute top-0 left-0 right-0 z-40 px-4 sm:px-6 h-14 flex items-center justify-between">
        <a href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
          <span className="text-lg font-bold text-indigo-400">⚡</span>
          <span className="text-sm font-semibold text-slate-100">GTM Engine</span>
        </a>
        <nav className="flex items-center gap-5 text-sm">
          <a href="/blog" className="text-slate-400 hover:text-slate-100 transition-colors">
            Blog
          </a>
          <a href="/faq" className="text-slate-400 hover:text-slate-100 transition-colors">
            FAQ
          </a>
          <a href="/contact" className="text-slate-400 hover:text-slate-100 transition-colors">
            Contact
          </a>
        </nav>
      </header>
      {children}
    </>
  )
}
