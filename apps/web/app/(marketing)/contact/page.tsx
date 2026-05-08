import type { Metadata } from 'next'

export const runtime = 'edge'

export const metadata: Metadata = {
  title: 'Contact',
  description: 'Get in touch with the GTM Engine team.',
  alternates: { canonical: 'https://gtmengine.qubitlyventures.com/contact' },
}

export default function ContactPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-16">
      {/* Hero */}
      <div className="text-center mb-16">
        <span className="inline-block text-xs font-medium text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 rounded-full px-3 py-1 mb-4">
          Contact
        </span>
        <h1 className="text-4xl sm:text-5xl font-bold text-slate-100 mb-4 tracking-tight">
          Get in touch
        </h1>
        <p className="text-xl text-slate-400 max-w-xl mx-auto leading-relaxed">
          We&apos;re here to help. Reach out with questions about GTM Engine, pricing, partnerships,
          or anything else.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Contact cards */}
        <div className="space-y-4">
          <ContactCard
            icon="✉️"
            title="Email us"
            description="For general enquiries, billing questions, or partnership opportunities."
            action={<a href="mailto:contact@qubitlyventures.com" className="text-indigo-400 hover:text-indigo-300 transition-colors font-medium">contact@qubitlyventures.com</a>}
          />
          <ContactCard
            icon="🐛"
            title="Report a bug"
            description="Found something broken? Let us know and we'll fix it fast."
            action={<a href="mailto:contact@qubitlyventures.com?subject=Bug+Report" className="text-indigo-400 hover:text-indigo-300 transition-colors font-medium">Send a bug report</a>}
          />
          <ContactCard
            icon="💡"
            title="Feature requests"
            description="Have an idea that would make GTM Engine better? We read every suggestion."
            action={<a href="mailto:contact@qubitlyventures.com?subject=Feature+Request" className="text-indigo-400 hover:text-indigo-300 transition-colors font-medium">Share your idea</a>}
          />
          <ContactCard
            icon="🤝"
            title="Partnerships"
            description="Interested in integrating with GTM Engine or building on top of our platform?"
            action={<a href="mailto:contact@qubitlyventures.com?subject=Partnership" className="text-indigo-400 hover:text-indigo-300 transition-colors font-medium">Start the conversation</a>}
          />
        </div>

        {/* Company info panel */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-6">
              <span className="text-2xl font-bold text-indigo-400">⚡</span>
              <span className="text-lg font-semibold text-slate-100">GTM Engine</span>
            </div>
            <p className="text-slate-400 leading-relaxed mb-6">
              GTM Engine is built by Qubitly Ventures — a deeptech company focused on AI and
              automation tools for high-growth B2B teams.
            </p>
            <div className="space-y-3 text-sm">
              <div className="flex items-start gap-3">
                <span className="text-slate-500 mt-0.5">📍</span>
                <span className="text-slate-400">Delhi NCR, India</span>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-slate-500 mt-0.5">🌐</span>
                <a
                  href="https://qubitlyventures.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-indigo-400 hover:text-indigo-300 transition-colors"
                >
                  qubitlyventures.com
                </a>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-slate-500 mt-0.5">✉️</span>
                <a
                  href="mailto:contact@qubitlyventures.com"
                  className="text-indigo-400 hover:text-indigo-300 transition-colors"
                >
                  contact@qubitlyventures.com
                </a>
              </div>
            </div>
          </div>

          <div className="mt-8 pt-6 border-t border-slate-800">
            <p className="text-xs text-slate-500 mb-4">Typical response time: within 24 hours on business days.</p>
            <a
              href="mailto:contact@qubitlyventures.com"
              className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium px-5 py-2.5 rounded-lg transition-colors w-full justify-center"
            >
              Send us a message
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}

function ContactCard({
  icon,
  title,
  description,
  action,
}: {
  icon: string
  title: string
  description: string
  action: React.ReactNode
}) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 hover:border-slate-700 transition-colors">
      <div className="flex items-start gap-4">
        <span className="text-2xl">{icon}</span>
        <div>
          <h3 className="text-sm font-semibold text-slate-100 mb-1">{title}</h3>
          <p className="text-xs text-slate-400 mb-2 leading-relaxed">{description}</p>
          {action}
        </div>
      </div>
    </div>
  )
}
