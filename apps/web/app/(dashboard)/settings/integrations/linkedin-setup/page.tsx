import Link from 'next/link'
import {
  ArrowLeft,
  ExternalLink,
  Building2,
  Linkedin,
  ShieldCheck,
  Key,
  AlertTriangle,
  CheckCircle2,
  Megaphone,
  MessageSquare,
  Sparkles,
  ChevronRight,
  Info,
  RefreshCw,
} from 'lucide-react'

interface StepProps {
  number: number
  title: string
  children: React.ReactNode
}

function Step({ number, title, children }: StepProps) {
  return (
    <div className="flex gap-5">
      {/* Number + connector */}
      <div className="flex flex-col items-center">
        <div className="w-9 h-9 rounded-full bg-indigo-600 flex items-center justify-center text-white font-bold text-sm shrink-0 shadow-[0_0_16px_rgba(99,102,241,0.35)]">
          {number}
        </div>
        <div className="w-px flex-1 bg-slate-800 mt-2" />
      </div>

      {/* Content */}
      <div className="pb-10 min-w-0 w-full">
        <h3 className="text-base font-semibold text-white mb-3">{title}</h3>
        <div className="text-sm text-slate-400 leading-relaxed space-y-3">
          {children}
        </div>
      </div>
    </div>
  )
}

function Scope({ name, desc }: { name: string; desc: string }) {
  return (
    <div className="flex items-start gap-2.5 py-1.5">
      <code className="shrink-0 mt-0.5 px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-indigo-300 text-xs font-mono">{name}</code>
      <span className="text-slate-400 text-xs">{desc}</span>
    </div>
  )
}

function Note({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2.5 rounded-lg bg-amber-900/20 border border-amber-700/30 px-3.5 py-3 text-sm text-amber-200/90">
      <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
      <span>{children}</span>
    </div>
  )
}

function InfoBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2.5 rounded-lg bg-slate-800/60 border border-slate-700/60 px-3.5 py-3 text-sm text-slate-300">
      <Info className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
      <span>{children}</span>
    </div>
  )
}

function Url({ href }: { href: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-indigo-400 hover:text-indigo-300 underline underline-offset-2 break-all"
    >
      {href}
      <ExternalLink className="w-3 h-3 shrink-0" />
    </a>
  )
}

export default function LinkedInSetupGuidePage() {
  return (
    <div className="mx-auto max-w-3xl px-4 md:px-6 py-6 md:py-10 space-y-8">

      {/* Back */}
      <Link
        href="/settings/integrations"
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-300 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Back to Integrations
      </Link>

      {/* Hero */}
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-[#0077B5]/15 border border-[#0077B5]/30 flex items-center justify-center">
            <Linkedin className="w-6 h-6 text-[#0077B5]" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white">How to Integrate LinkedIn with GTM Engine</h1>
            <p className="text-slate-400 text-sm mt-1">Create a LinkedIn developer app, request the right scopes, generate a token, and connect — step by step.</p>
          </div>
        </div>
      </div>

      {/* What this unlocks */}
      <div className="rounded-xl border border-slate-700/60 bg-slate-900/50 p-5 space-y-3">
        <h2 className="text-sm font-semibold text-slate-200">What this unlocks</h2>
        <div className="grid sm:grid-cols-3 gap-3">
          {[
            { Icon: Sparkles, title: 'Ask Feature', desc: 'AI answers questions about your live LinkedIn ad metrics inside Campaigns.' },
            { Icon: MessageSquare, title: 'Company Posts', desc: 'Publish posts to your LinkedIn company page directly from GTM Engine.' },
            { Icon: Megaphone, title: 'Post Library', desc: 'View your recent company page posts in Settings → Integrations.' },
          ].map(({ Icon, title, desc }) => (
            <div key={title} className="flex gap-3 rounded-lg bg-slate-800/50 border border-slate-700/50 p-3">
              <Icon className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
              <div>
                <div className="text-xs font-semibold text-slate-200">{title}</div>
                <div className="text-xs text-slate-500 mt-0.5">{desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Critical notice */}
      <div className="rounded-xl border border-[#0077B5]/30 bg-[#0077B5]/10 p-5 space-y-2">
        <div className="flex items-center gap-2 text-[#5db8e8] font-semibold text-sm">
          <Building2 className="w-4 h-4" />
          Important: Use the account that owns your LinkedIn company page
        </div>
        <p className="text-sm text-slate-300 leading-relaxed">
          GTM Engine operates entirely at the <strong className="text-white">organisation level</strong> — it reads and posts
          on behalf of your <strong className="text-white">LinkedIn Company Page</strong>, not any individual&apos;s personal feed.
          When generating the access token (Step 5), you must be signed in with the LinkedIn account
          that has <strong className="text-white">Administrator</strong> access to the company page you want to connect.
          If you generate the token from an account with no admin role, the connection will succeed but
          posting and post-reading will silently return empty results.
        </p>
      </div>

      {/* 60-day token expiry callout */}
      <div className="rounded-xl border border-amber-600/30 bg-amber-950/30 p-5 space-y-2">
        <div className="flex items-center gap-2 text-amber-300 font-semibold text-sm">
          <RefreshCw className="w-4 h-4" />
          Tokens expire every 60 days — plan for renewal
        </div>
        <p className="text-sm text-slate-300 leading-relaxed">
          LinkedIn access tokens are valid for <strong className="text-white">60 days only</strong> (roughly 2 months).
          Once expired, the Ask feature and company posting will stop working — no data will be lost,
          but you will need to generate a new token and reconnect.
        </p>
        <ul className="text-sm text-slate-400 space-y-1 mt-1">
          {[
            'Repeat Step 5 to generate a fresh token.',
            'Go to Settings → Integrations → Disconnect, then paste the new token.',
            'Set a calendar reminder for 55 days after your first connection.',
          ].map((s, i) => (
            <li key={i} className="flex gap-2">
              <span className="text-amber-600 font-mono text-xs shrink-0 mt-0.5">{i + 1}.</span>
              {s}
            </li>
          ))}
        </ul>
      </div>

      {/* Steps */}
      <div className="pt-2">
        <Step number={1} title="Go to the LinkedIn Developers portal">
          <p>Open the developer portal in your browser:</p>
          <div className="rounded-lg bg-slate-900 border border-slate-800 px-3.5 py-2.5">
            <Url href="https://www.linkedin.com/developers/" />
          </div>
          <p>
            Sign in with the LinkedIn account that is an <span className="text-white font-medium">Administrator of your company page</span>.
            This is critical — the token you generate will only have the org scopes
            if the signing account actually administers the page.
          </p>
        </Step>

        <Step number={2} title="Create a new LinkedIn App">
          <p>Click <strong className="text-white">Create App</strong> and fill in the form:</p>
          <ul className="space-y-1.5 list-none ml-0">
            {[
              { field: 'App name', val: 'e.g. "GTM Engine – Qubitly" (any name you like)' },
              { field: 'LinkedIn Page', val: 'Select your company page — this associates the app with your org.' },
              { field: 'Privacy policy URL', val: 'Your public privacy policy page (required by LinkedIn).' },
              { field: 'App logo', val: 'Upload any 100×100 px image (can be your logo).' },
            ].map(({ field, val }) => (
              <li key={field} className="flex gap-2">
                <ChevronRight className="w-3.5 h-3.5 text-indigo-500 shrink-0 mt-0.5" />
                <span><strong className="text-slate-200">{field}:</strong> {val}</span>
              </li>
            ))}
          </ul>
          <p>Click <strong className="text-white">Create App</strong>.</p>
          <Note>
            <strong>LinkedIn Page is mandatory.</strong> If you skip it or select the wrong page,
            the org scopes won&apos;t work. You can edit this later in the app&apos;s Settings tab.
          </Note>
        </Step>

        <Step number={3} title="Verify the app with your company page">
          <p>
            LinkedIn requires an admin of the company page to verify the app before org-level
            scopes are granted.
          </p>
          <ul className="space-y-1.5 list-none ml-0">
            {[
              'In your new app, open the Settings tab.',
              'Under LinkedIn Page, click Verify.',
              'A verification request is sent to the page admins. Approve it from the page admin account.',
            ].map((s, i) => (
              <li key={i} className="flex gap-2">
                <span className="text-indigo-400 font-mono text-xs shrink-0 mt-0.5">{i + 1}.</span>
                <span>{s}</span>
              </li>
            ))}
          </ul>
          <InfoBox>
            If you are already signed in as a page admin, the verification is instant.
            Otherwise it will send an email to the admins of the page.
          </InfoBox>
        </Step>

        <Step number={4} title="Request the required LinkedIn products">
          <p>
            LinkedIn groups API permissions into <strong className="text-white">Products</strong>.
            Go to the <strong className="text-white">Products</strong> tab of your app and request access to:
          </p>

          <div className="rounded-xl border border-slate-700/60 bg-slate-800/40 divide-y divide-slate-700/50">
            {[
              {
                product: 'Community Management API',
                note: 'Usually auto-approved for verified pages.',
                scopes: [
                  { name: 'r_organization_admin', desc: 'Identifies which company pages you administer.' },
                  { name: 'r_organization_social', desc: 'Reads posts from your company page.' },
                  { name: 'w_organization_social', desc: 'Publishes posts to your company page.' },
                ],
              },
              {
                product: 'Marketing Developer Platform',
                note: 'May take 1–2 business days to be approved by LinkedIn.',
                scopes: [
                  { name: 'r_ads', desc: 'Read ad campaign data (impressions, clicks, spend).' },
                  { name: 'r_ads_reporting', desc: 'Read campaign performance analytics.' },
                ],
              },
              {
                product: 'Sign In with LinkedIn using OpenID Connect',
                note: 'Auto-approved immediately.',
                scopes: [
                  { name: 'openid', desc: 'OpenID identity token.' },
                  { name: 'profile', desc: 'Your display name.' },
                  { name: 'email', desc: 'Your email address.' },
                ],
              },
            ].map(({ product, note, scopes }) => (
              <div key={product} className="p-4 space-y-2">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <span className="text-sm font-semibold text-white">{product}</span>
                  <span className="text-xs text-slate-500 italic">{note}</span>
                </div>
                <div className="divide-y divide-slate-700/30">
                  {scopes.map(s => <Scope key={s.name} name={s.name} desc={s.desc} />)}
                </div>
              </div>
            ))}
          </div>

          <Note>
            GTM Engine does <strong>not</strong> use personal post scopes (
            <code className="text-xs bg-slate-800 px-1 rounded">r_member_social</code>).
            Everything is company-page only. You do not need to request that scope.
          </Note>
        </Step>

        <Step number={5} title="Generate a 60-day access token">
          <p>
            Once the products above are approved, generate a token using the LinkedIn Token Generator:
          </p>
          <div className="rounded-lg bg-slate-900 border border-slate-800 px-3.5 py-2.5">
            <Url href="https://www.linkedin.com/developers/tools/oauth/token-generator" />
          </div>
          <ul className="space-y-1.5 list-none ml-0">
            {[
              'Select your app from the dropdown.',
              'Check all the scopes you requested: r_organization_admin, r_organization_social, w_organization_social, r_ads, r_ads_reporting, openid, profile, email.',
              'Click Request access token.',
              'LinkedIn will ask you to authorise — sign in as the company page admin account.',
              'Copy the generated access token. It is valid for 60 days.',
            ].map((s, i) => (
              <li key={i} className="flex gap-2">
                <span className="text-indigo-400 font-mono text-xs shrink-0 mt-0.5">{i + 1}.</span>
                <span>{s}</span>
              </li>
            ))}
          </ul>
          <div className="flex items-start gap-2.5 rounded-lg bg-emerald-900/20 border border-emerald-700/30 px-3.5 py-3 text-sm text-emerald-200/90">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <span>
              GTM Engine encrypts this token with <strong>AES-256-GCM</strong> before saving it to the database.
              It is never returned to the browser after the initial save.
            </span>
          </div>
        </Step>

        <Step number={6} title="Find your LinkedIn Ad Account ID">
          <p>
            You need this for the campaign ask feature (ad metrics). Skip this step if you
            only want the company page post features.
          </p>
          <ul className="space-y-1.5 list-none ml-0">
            {[
              { text: <>Go to <Url href="https://www.linkedin.com/campaignmanager/" /></> },
              { text: 'Open any campaign or the account dashboard.' },
              { text: 'Look at the URL — it will contain /accounts/XXXXXXXXX/. Copy those digits.' },
            ].map((s, i) => (
              <li key={i} className="flex gap-2 items-start">
                <span className="text-indigo-400 font-mono text-xs shrink-0 mt-0.5">{i + 1}.</span>
                <span>{s.text}</span>
              </li>
            ))}
          </ul>
          <div className="rounded-lg bg-slate-900 border border-slate-800 px-3.5 py-2.5 font-mono text-xs text-slate-300 break-all">
            https://www.linkedin.com/campaignmanager/accounts/<strong className="text-indigo-300">506795881</strong>/campaigns/...
          </div>
          <InfoBox>
            The Ad Account ID must belong to the same LinkedIn company page / organisation.
            If you have multiple ad accounts, use the one attached to the company page you are connecting.
          </InfoBox>
        </Step>

        <Step number={7} title="Paste into GTM Engine and save">
          <p>You now have everything you need. Head back to the Integrations page and paste the values:</p>
          <ul className="space-y-1.5 list-none ml-0">
            {[
              'LinkedIn Access Token — the 60-day token from Step 5.',
              'Ad Account ID — the digits from Step 6 (optional if you only want posting).',
              'Display name — a friendly label like "Qubitly EMEA" (optional).',
            ].map((s, i) => (
              <li key={i} className="flex gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                <span>{s}</span>
              </li>
            ))}
          </ul>
          <p>Click <strong className="text-white">Connect LinkedIn</strong>. GTM Engine will verify the token immediately.</p>

          {/* CTA */}
          <div className="pt-2">
            <Link
              href="/settings/integrations"
              className="inline-flex items-center gap-2 px-5 h-9 rounded-lg text-sm font-medium bg-[#0077B5] hover:bg-[#0099e0] text-white transition-colors"
            >
              <Linkedin className="w-4 h-4" />
              Go to Integrations → Connect
            </Link>
          </div>
        </Step>
      </div>

      {/* Token renewal reminder */}
      <div className="rounded-xl border border-slate-700/50 bg-slate-900/40 p-5 space-y-2">
        <div className="flex items-center gap-2 text-slate-300 font-semibold text-sm">
          <Key className="w-4 h-4 text-slate-400" />
          Token renewal (every 60 days)
        </div>
        <p className="text-sm text-slate-400 leading-relaxed">
          LinkedIn access tokens expire after 60 days. When your token expires, the Ask feature
          and company posting will stop working. To renew:
        </p>
        <ul className="space-y-1 text-sm text-slate-400">
          {[
            'Repeat Step 5 to generate a new token.',
            'Come back to Settings → Integrations.',
            'Disconnect the existing connection, then paste the new token and reconnect.',
          ].map((s, i) => (
            <li key={i} className="flex gap-2">
              <span className="text-slate-600 font-mono text-xs shrink-0 mt-0.5">{i + 1}.</span>
              {s}
            </li>
          ))}
        </ul>
        <InfoBox>
          We recommend setting a calendar reminder 55 days after connecting, so you never hit
          a hard expiry during an active campaign.
        </InfoBox>
      </div>

      {/* FAQ */}
      <div className="rounded-xl border border-slate-700/50 bg-slate-900/40 divide-y divide-slate-800 overflow-hidden">
        <div className="px-5 py-3 bg-slate-800/40">
          <h2 className="text-sm font-semibold text-slate-200">Frequently asked questions</h2>
        </div>
        {[
          {
            q: 'Do I need to share this with LinkedIn or submit for review?',
            a: 'No. GTM Engine uses a manual token flow — you generate the token yourself in the developer portal, then paste it here. There is no OAuth redirect or LinkedIn app review needed for this use case.',
          },
          {
            q: 'Can I use a personal LinkedIn account token?',
            a: 'You can, but it only works if that personal account has Administrator access to the company page. GTM Engine exclusively operates on company pages — it will not post to or read personal feeds.',
          },
          {
            q: 'What happens if I connect the wrong page?',
            a: 'The connection will save successfully, but posting and post-reading will return results for whichever company page the token admin account manages. Disconnect and reconnect with a token from the correct page admin.',
          },
          {
            q: 'Can my team members use the features if I am the one who connected?',
            a: 'Yes. The connection is org-level — all team members in your GTM Engine organisation will be able to see posts and use the Ask feature. Posting to LinkedIn is done under the app\'s credentials, not individual team members\' personal accounts.',
          },
          {
            q: 'I don\'t have a LinkedIn Ads account. Can I still post and use Ask?',
            a: 'Posting and post-reading work without an Ad Account ID — just leave the field blank or enter 0. The Ask feature will still work for general campaign context; it just won\'t pull live ad metrics.',
          },
        ].map(({ q, a }) => (
          <div key={q} className="px-5 py-4 space-y-1.5">
            <div className="text-sm font-medium text-slate-200">{q}</div>
            <div className="text-sm text-slate-400 leading-relaxed">{a}</div>
          </div>
        ))}
      </div>

      {/* Bottom CTA */}
      <div className="flex items-center justify-between gap-4 pt-2 flex-wrap">
        <Link
          href="/settings/integrations"
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-300 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Integrations
        </Link>
        <Link
          href="/settings/integrations"
          className="inline-flex items-center gap-2 px-5 h-9 rounded-lg text-sm font-medium bg-[#0077B5] hover:bg-[#0099e0] text-white transition-colors"
        >
          <Linkedin className="w-4 h-4" />
          Ready — Connect LinkedIn
        </Link>
      </div>

    </div>
  )
}
