import type { Metadata } from 'next'
import { sanityClient } from '@/lib/sanity/client'
import type { SanityFaq } from '@/lib/sanity/types'
import Link from 'next/link'

export const runtime = 'edge'

export const metadata: Metadata = {
  title: 'FAQ',
  description:
    'Frequently asked questions about GTM Engine — AI-powered go-to-market platform for B2B teams. Learn about campaigns, LinkedIn integration, AI models, ICP enrichment, and data security.',
  openGraph: {
    title: 'GTM Engine — Frequently Asked Questions',
    description: 'Everything you need to know about GTM Engine.',
    url: 'https://gtmengine.qubitlyventures.com/faq',
    type: 'website',
  },
  alternates: {
    canonical: 'https://gtmengine.qubitlyventures.com/faq',
  },
}

const FAQ_QUERY = `
  *[_type == "faq"] | order(order asc, category asc, _createdAt asc) {
    _id,
    question,
    answer,
    category,
    order
  }
`

const CATEGORY_LABELS: Record<string, string> = {
  general: 'General',
  features: 'Features',
  linkedin: 'LinkedIn Integration',
  pricing: 'Pricing',
  security: 'Security',
  'ai-models': 'AI Models',
  enrichment: 'Prospect Enrichment',
}

export default async function FaqPage() {
  const faqs = await sanityClient.fetch<SanityFaq[]>(
    FAQ_QUERY,
    {},
    { next: { revalidate: 3600 } },
  )

  // Build FAQPage JSON-LD from Sanity content (supplements the hardcoded one on auth pages)
  const faqSchema =
    faqs.length > 0
      ? {
          '@context': 'https://schema.org',
          '@type': 'FAQPage',
          mainEntity: faqs.map((faq) => ({
            '@type': 'Question',
            name: faq.question,
            acceptedAnswer: {
              '@type': 'Answer',
              text: faq.answer,
            },
          })),
        }
      : null

  // Group by category
  const grouped = faqs.reduce<Record<string, SanityFaq[]>>((acc, faq) => {
    const key = faq.category || 'general'
    if (!acc[key]) acc[key] = []
    acc[key].push(faq)
    return acc
  }, {})

  const categoryKeys = Object.keys(grouped)

  return (
    <>
      {faqSchema && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
        />
      )}

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-16">
        {/* Hero */}
        <div className="mb-16 text-center">
          <h1 className="text-4xl sm:text-5xl font-bold text-slate-100 mb-4 tracking-tight">
            Frequently Asked Questions
          </h1>
          <p className="text-xl text-slate-400 max-w-2xl mx-auto leading-relaxed">
            Everything you need to know about GTM Engine.
          </p>
        </div>

        {faqs.length === 0 ? (
          /* No Sanity FAQs yet — show a curated static set */
          <StaticFaqs />
        ) : categoryKeys.length === 1 ? (
          /* Single category — flat list */
          <div className="space-y-6">
            {grouped[categoryKeys[0]].map((faq) => (
              <FaqItem key={faq._id} faq={faq} />
            ))}
          </div>
        ) : (
          /* Multiple categories — grouped */
          <div className="space-y-14">
            {categoryKeys.map((key) => (
              <section key={key}>
                <h2 className="text-lg font-semibold text-slate-300 mb-6 pb-3 border-b border-slate-800">
                  {CATEGORY_LABELS[key] || key}
                </h2>
                <div className="space-y-6">
                  {grouped[key].map((faq) => (
                    <FaqItem key={faq._id} faq={faq} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}

        {/* CTA */}
        <div className="mt-16 p-8 bg-indigo-600/10 border border-indigo-500/20 rounded-2xl text-center">
          <p className="text-lg font-semibold text-slate-100 mb-2">Still have questions?</p>
          <p className="text-sm text-slate-400 mb-5">
            Sign up for free and explore GTM Engine — no credit card required.
          </p>
          <Link
            href="/signup"
            className="inline-block bg-indigo-600 hover:bg-indigo-500 text-white font-medium px-6 py-3 rounded-lg transition-colors"
          >
            Get started free
          </Link>
        </div>
      </div>
    </>
  )
}

function FaqItem({ faq }: { faq: SanityFaq }) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 hover:border-slate-700 transition-colors">
      <h3 className="text-base font-semibold text-slate-100 mb-3">{faq.question}</h3>
      <p className="text-sm text-slate-400 leading-relaxed">{faq.answer}</p>
    </div>
  )
}

// Shown until Sanity FAQs are published — mirrors the hardcoded (public)/layout.tsx FAQPage schema
function StaticFaqs() {
  const items = [
    {
      q: 'What is GTM Engine?',
      a: 'GTM Engine is an AI-powered go-to-market platform for B2B marketing and sales teams. It ingests and scores real-time market signals from global data sources to surface the trends that matter to your business, generates AI images and videos grounded in your brand context, identifies and enriches ICP prospects using AI-powered search, produces personalised outreach copy and a full campaign brief — complete with posting schedule, hashtag sets, and caption variants — publishes content directly to your LinkedIn company page, and gives your team a conversational AI assistant to ask questions about live campaign performance and LinkedIn metrics, all in a single end-to-end workspace.',
    },
    {
      q: 'How does GTM Engine help B2B marketing teams?',
      a: 'GTM Engine generates structured campaign briefs using AI — including posting schedules, key messages, and hashtag sets. Teams generate images and videos directly from campaigns, enrich ICP prospects with enrichment data, and produce personalised outreach copy for LinkedIn DM, email, and cold calls.',
    },
    {
      q: 'Does GTM Engine integrate with LinkedIn?',
      a: 'Yes. Connect your LinkedIn company page using a 60-day access token from the LinkedIn Developer Portal. Once connected, you can read company posts, publish new posts with or without images, and use the Campaign Ask feature to query live LinkedIn ad metrics.',
    },
    {
      q: 'What AI models does GTM Engine use?',
      a: 'We benchmark and route every step to the AI model that performs best today and swap it out the moment a better one launches. You never have to think about it.',
    },
    {
      q: 'How does prospect enrichment work?',
      a: 'GTM Engine runs an AI-powered global search tailored to your ideal customer profile. It finds and enriches prospects based on the industries, job titles, company sizes, and geographies that matter to your business — then calculates a fit score so you know exactly who to prioritise.',
    },
    {
      q: 'Is my data secure?',
      a: 'Yes. Your data is encrypted in transit and at rest, isolated to your organisation, and never shared with other customers or used to train AI models. We follow industry-standard security practices and access controls.',
    },
  ]

  const staticFaqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((item) => ({
      '@type': 'Question',
      name: item.q,
      acceptedAnswer: { '@type': 'Answer', text: item.a },
    })),
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(staticFaqSchema) }}
      />
      <div className="space-y-6">
        {items.map((item, i) => (
          <div
            key={i}
            className="bg-slate-900 border border-slate-800 rounded-xl p-6 hover:border-slate-700 transition-colors"
          >
            <h3 className="text-base font-semibold text-slate-100 mb-3">{item.q}</h3>
            <p className="text-sm text-slate-400 leading-relaxed">{item.a}</p>
          </div>
        ))}
      </div>
    </>
  )
}
