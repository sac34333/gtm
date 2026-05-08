import type { Metadata } from 'next'
import Link from 'next/link'

export const runtime = 'edge'

export const metadata: Metadata = {
  title: 'Terms of Service',
  description: 'Terms and conditions for using GTM Engine by Qubitly Ventures.',
  alternates: { canonical: 'https://gtmengine.qubitlyventures.com/terms' },
}

export default function TermsPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-16">
      <div className="mb-10">
        <span className="inline-block text-xs font-medium text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 rounded-full px-3 py-1 mb-4">
          Legal
        </span>
        <h1 className="text-4xl font-bold text-slate-100 mb-4 tracking-tight">Terms of Service</h1>
        <p className="text-slate-400">Last updated: May 8, 2026</p>
      </div>

      <div className="prose prose-invert prose-slate max-w-none space-y-8 text-slate-300 leading-relaxed">
        <section>
          <h2 className="text-xl font-semibold text-slate-100 mb-3">1. Acceptance of Terms</h2>
          <p>
            By accessing or using GTM Engine (&quot;Service&quot;), you agree to be bound by these Terms of
            Service (&quot;Terms&quot;). GTM Engine is operated by Qubitly Ventures LLP (&quot;Qubitly
            Ventures&quot;, &quot;we&quot;, &quot;us&quot;). If you do not agree to these Terms, do not use the Service.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-slate-100 mb-3">2. Description of Service</h2>
          <p>
            GTM Engine is an AI-powered go-to-market platform for B2B marketing and sales teams.
            It includes campaign brief generation, ICP enrichment, AI image and video creation,
            LinkedIn publishing, signal ingestion, and campaign analytics tools.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-slate-100 mb-3">3. Accounts and Access</h2>
          <ul className="list-disc pl-5 space-y-2">
            <li>You must be at least 18 years old to create an account.</li>
            <li>You are responsible for maintaining the security of your account credentials.</li>
            <li>Each organisation may add team members up to the limits of their subscription plan.</li>
            <li>You are responsible for all activity that occurs under your account.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-slate-100 mb-3">4. Acceptable Use</h2>
          <p className="mb-3">You agree not to use GTM Engine to:</p>
          <ul className="list-disc pl-5 space-y-2">
            <li>Generate content that is unlawful, defamatory, harassing, or fraudulent.</li>
            <li>Violate the intellectual property rights of any third party.</li>
            <li>Send unsolicited communications (spam) to individuals.</li>
            <li>Attempt to reverse-engineer, scrape, or extract data from the platform.</li>
            <li>Use the platform in a way that exceeds your subscription quota limits.</li>
            <li>Impersonate any person or entity.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-slate-100 mb-3">5. AI-Generated Content</h2>
          <p>
            GTM Engine uses third-party AI models to generate campaign briefs, images, video, and
            copy. You retain ownership of the output you generate through the platform. However,
            you are solely responsible for reviewing AI-generated content before publishing it.
            We do not guarantee the accuracy, completeness, or suitability of AI-generated content.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-slate-100 mb-3">6. Billing and Subscriptions</h2>
          <ul className="list-disc pl-5 space-y-2">
            <li>Subscriptions are billed in advance on a monthly or annual basis.</li>
            <li>Payments are processed by Dodo Payments. By subscribing, you agree to Dodo Payments&apos; terms.</li>
            <li>Refunds are issued at our discretion within 7 days of payment for billing errors.</li>
            <li>We may change subscription pricing with 30 days&apos; notice.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-slate-100 mb-3">7. Quotas and Usage Limits</h2>
          <p>
            Each subscription plan includes monthly quotas for AI generation, enrichment, and
            signal ingestion. Quotas reset at the start of each billing cycle. Exceeding quota
            will pause generation features until the next reset or until you upgrade your plan.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-slate-100 mb-3">8. Intellectual Property</h2>
          <p>
            GTM Engine, including its interface, design, and underlying technology, is owned by
            Qubitly Ventures LLP. You may not copy, modify, or distribute any part of the platform
            without our written consent. You grant us a limited licence to process your data solely
            to provide the Service.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-slate-100 mb-3">9. Limitation of Liability</h2>
          <p>
            To the maximum extent permitted by applicable law, Qubitly Ventures shall not be
            liable for any indirect, incidental, special, or consequential damages arising from
            your use of GTM Engine. Our total liability for any claim shall not exceed the amount
            you paid to us in the 3 months preceding the claim.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-slate-100 mb-3">10. Termination</h2>
          <p>
            We may suspend or terminate your account at any time for violation of these Terms.
            You may cancel your subscription at any time from your account settings. Upon
            termination, your access to the platform ceases and your data will be deleted in
            accordance with our{' '}
            <Link href="/privacy" className="text-indigo-400 hover:text-indigo-300 transition-colors">
              Privacy Policy
            </Link>.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-slate-100 mb-3">11. Governing Law</h2>
          <p>
            These Terms are governed by the laws of India. Any disputes shall be subject to the
            exclusive jurisdiction of the courts in Delhi NCR, India.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-slate-100 mb-3">12. Contact</h2>
          <p>
            Questions about these Terms? Email us at{' '}
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
