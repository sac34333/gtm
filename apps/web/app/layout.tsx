import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Providers } from './providers'
import { Toaster } from 'sonner'

// Run the entire app on the Edge runtime so it can be deployed to
// Cloudflare Pages via @cloudflare/next-on-pages.
export const runtime = 'edge'

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' })

const BASE_URL = 'https://gtmengine.qubitlyventures.com'

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  title: {
    default: 'GTM Engine — AI-Powered Go-to-Market Platform',
    template: '%s | GTM Engine',
  },
  description:
    'Build campaigns, enrich B2B prospects, generate creative assets, and post to LinkedIn — all powered by AI. The complete go-to-market platform for outbound and content-driven teams.',
  keywords: [
    'GTM platform',
    'go-to-market AI',
    'B2B marketing automation',
    'AI campaign builder',
    'prospect enrichment',
    'LinkedIn marketing tool',
    'AI content generation',
    'campaign management software',
    'outbound sales AI',
    'GTM Engine',
  ],
  authors: [{ name: 'Qubitly Ventures', url: 'https://qubitlyventures.com' }],
  creator: 'Qubitly Ventures',
  publisher: 'Qubitly Ventures',
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: BASE_URL,
    siteName: 'GTM Engine',
    title: 'GTM Engine — AI-Powered Go-to-Market Platform',
    description:
      'Build campaigns, enrich B2B prospects, generate creative assets, and post to LinkedIn — all powered by AI.',
    images: [
      {
        url: '/opengraph-image',
        width: 1200,
        height: 630,
        alt: 'GTM Engine — AI-Powered Go-to-Market Platform',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'GTM Engine — AI-Powered Go-to-Market Platform',
    description:
      'Build campaigns, enrich B2B prospects, generate creative assets, and post to LinkedIn — all powered by AI.',
    images: ['/opengraph-image'],
    creator: '@qubitlyventures',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  category: 'technology',
}

// ── Global JSON-LD Schemas ────────────────────────────────────────────────────
const organizationSchema = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'Qubitly Ventures',
  alternateName: 'Qubitly',
  url: 'https://qubitlyventures.com',
  foundingDate: '2023',
  description:
    'AI engineering company building production-grade AI products and platforms, including GTM Engine.',
  sameAs: ['https://www.linkedin.com/company/qubitlyventures/'],
  knowsAbout: [
    'Go-to-Market Strategy',
    'B2B Marketing Automation',
    'AI Content Generation',
    'Prospect Enrichment',
    'LinkedIn Marketing',
    'Campaign Management',
    'Large Language Models',
    'Outbound Sales',
  ],
}

const softwareSchema = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'GTM Engine',
  applicationCategory: 'BusinessApplication',
  applicationSubCategory: 'Marketing Automation',
  operatingSystem: 'Web',
  url: BASE_URL,
  inLanguage: 'en',
  description:
    'AI-powered go-to-market platform for B2B teams. Build campaigns, enrich ICP prospects, generate creative assets, post to LinkedIn, and chat with your campaign data using AI.',
  featureList: [
    'AI Campaign Builder with brief generation and posting schedule',
    'ICP Prospect Enrichment (PDL, Apollo, Hunter, Clearbit)',
    'AI Image and Video Generation via fal.ai',
    'LinkedIn Company Page Integration — post and read metrics',
    'Campaign Ask — conversational AI using live LinkedIn ad data',
    'Signal Ingestion from HackerNews, Reddit, RSS, LinkedIn, ProductHunt, and more',
  ],
  offers: {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'USD',
    description: 'Free trial available — no credit card required to start.',
  },
  provider: {
    '@type': 'Organization',
    name: 'Qubitly Ventures',
    url: 'https://qubitlyventures.com',
  },
}

const websiteSchema = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: 'GTM Engine',
  url: BASE_URL,
  description: 'AI-powered go-to-market platform for B2B marketing and sales teams.',
  inLanguage: 'en',
  publisher: {
    '@type': 'Organization',
    name: 'Qubitly Ventures',
    url: 'https://qubitlyventures.com',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareSchema) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteSchema) }}
        />
      </head>
      <body className={`${inter.variable} font-sans antialiased`}>
        <Providers>
          {children}
          <Toaster richColors position="top-right" />
        </Providers>
      </body>
    </html>
  )
}
