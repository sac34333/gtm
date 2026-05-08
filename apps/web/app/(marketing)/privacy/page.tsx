import type { Metadata } from 'next'
import Link from 'next/link'

export const runtime = 'edge'

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'How GTM Engine collects, uses, and protects your data.',
  alternates: { canonical: 'https://gtmengine.qubitlyventures.com/privacy' },
}

export default function PrivacyPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-16">
      <div className="mb-10">
        <span className="inline-block text-xs font-medium text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 rounded-full px-3 py-1 mb-4">
          Legal
        </span>
        <h1 className="text-4xl font-bold text-slate-100 mb-4 tracking-tight">Privacy Policy</h1>
        <p className="text-slate-400">Last updated: May 8, 2026</p>
      </div>

      <div className="prose prose-invert prose-slate max-w-none space-y-8 text-slate-300 leading-relaxed">
        <section>
          <h2 className="text-xl font-semibold text-slate-100 mb-3">1. Who We Are</h2>
          <p>
            GTM Engine is a product of Qubitly Ventures LLP (&quot;Qubitly Ventures&quot;, &quot;we&quot;, &quot;us&quot;, &quot;our&quot;).
            We operate an AI-powered go-to-market platform for B2B marketing and sales teams.
            Our registered address is Delhi NCR, India. Contact us at{' '}
            <a href="mailto:contact@qubitlyventures.com" className="text-indigo-400 hover:text-indigo-300 transition-colors">
              contact@qubitlyventures.com
            </a>.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-slate-100 mb-3">2. Information We Collect</h2>
          <p className="mb-3">We collect information you provide directly to us, including:</p>
          <ul className="list-disc pl-5 space-y-2">
            <li><strong className="text-slate-200">Account data</strong> — name, email address, organisation name when you create an account.</li>
            <li><strong className="text-slate-200">Billing data</strong> — payment details processed securely by Dodo Payments. We do not store card numbers.</li>
            <li><strong className="text-slate-200">Usage data</strong> — campaigns created, assets generated, signals ingested, and feature usage to improve the platform.</li>
            <li><strong className="text-slate-200">Integration credentials</strong> — API keys for third-party providers (e.g. LinkedIn, OpenRouter) stored AES-256-GCM encrypted at rest.</li>
            <li><strong className="text-slate-200">ICP and prospect data</strong> — company and contact information you upload or enrich through the platform.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-slate-100 mb-3">3. How We Use Your Information</h2>
          <ul className="list-disc pl-5 space-y-2">
            <li>To provide, operate, and improve GTM Engine.</li>
            <li>To process payments and manage your subscription.</li>
            <li>To send transactional emails (e.g. campaign completion, video export ready).</li>
            <li>To detect and prevent fraud, abuse, and security incidents.</li>
            <li>To comply with legal obligations.</li>
          </ul>
          <p className="mt-3">We do not sell your personal data to third parties.</p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-slate-100 mb-3">4. Data Sharing</h2>
          <p className="mb-3">We share data only with:</p>
          <ul className="list-disc pl-5 space-y-2">
            <li><strong className="text-slate-200">Supabase</strong> — database and authentication infrastructure.</li>
            <li><strong className="text-slate-200">Cloudflare</strong> — CDN, edge functions, and security.</li>
            <li><strong className="text-slate-200">AI providers</strong> — OpenRouter, fal.ai, Google Gemini for content generation (prompts only; no personal data).</li>
            <li><strong className="text-slate-200">Dodo Payments</strong> — payment processing.</li>
            <li><strong className="text-slate-200">Sentry</strong> — error monitoring (anonymised stack traces only).</li>
            <li><strong className="text-slate-200">Langfuse</strong> — AI observability (prompt and response metadata only).</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-slate-100 mb-3">5. Data Retention</h2>
          <p>
            We retain your account data for as long as your account is active. If you close your
            account, we delete your personal data within 30 days, except where we are required to
            retain it for legal or financial compliance purposes.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-slate-100 mb-3">6. Your Rights</h2>
          <p className="mb-3">Depending on your jurisdiction, you may have the right to:</p>
          <ul className="list-disc pl-5 space-y-2">
            <li>Access the personal data we hold about you.</li>
            <li>Request correction of inaccurate data.</li>
            <li>Request deletion of your data.</li>
            <li>Object to or restrict certain processing.</li>
            <li>Data portability.</li>
          </ul>
          <p className="mt-3">
            To exercise any of these rights, email us at{' '}
            <a href="mailto:contact@qubitlyventures.com" className="text-indigo-400 hover:text-indigo-300 transition-colors">
              contact@qubitlyventures.com
            </a>.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-slate-100 mb-3">7. Cookies</h2>
          <p>
            We use cookies and similar technologies to maintain your session, remember preferences,
            and analyse platform usage. You can control cookies through your browser settings.
            Disabling cookies may affect platform functionality.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-slate-100 mb-3">8. Security</h2>
          <p>
            All data is encrypted in transit (TLS 1.3) and at rest (AES-256). API keys are stored
            with AES-256-GCM encryption. We conduct periodic security reviews and apply
            industry-standard access controls. No method of transmission over the internet is 100%
            secure; we cannot guarantee absolute security.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-slate-100 mb-3">9. Changes to This Policy</h2>
          <p>
            We may update this policy from time to time. We will notify you of material changes
            by email or via a notice in the platform. Continued use of GTM Engine after changes
            constitutes acceptance of the updated policy.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-slate-100 mb-3">10. Contact</h2>
          <p>
            For any privacy-related questions, contact us at{' '}
            <a href="mailto:contact@qubitlyventures.com" className="text-indigo-400 hover:text-indigo-300 transition-colors">
              contact@qubitlyventures.com
            </a>{' '}
            or visit our{' '}
            <Link href="/contact" className="text-indigo-400 hover:text-indigo-300 transition-colors">
              contact page
            </Link>.
          </p>
        </section>
      </div>
    </div>
  )
}
