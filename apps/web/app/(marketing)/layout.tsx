import Link from 'next/link'

export const runtime = 'edge'

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* Navigation */}
      <header className="sticky top-0 z-40 border-b border-slate-800 bg-slate-950/90 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <span className="text-xl font-bold text-indigo-400">⚡</span>
            <span className="text-base font-semibold text-slate-100">GTM Engine</span>
          </Link>
          <nav className="hidden md:flex items-center gap-6 text-sm">
            <Link href="/blog" className="text-slate-400 hover:text-slate-100 transition-colors">
              Blog
            </Link>
            <Link href="/faq" className="text-slate-400 hover:text-slate-100 transition-colors">
              FAQ
            </Link>
            <Link href="/contact" className="text-slate-400 hover:text-slate-100 transition-colors">
              Contact
            </Link>
          </nav>
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="text-sm text-slate-400 hover:text-slate-100 transition-colors"
            >
              Sign in
            </Link>
            <Link
              href="/signup"
              className="text-sm bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg transition-colors font-medium"
            >
              Get started
            </Link>
          </div>
        </div>
      </header>

      <main>{children}</main>

      {/* Footer */}
      <footer className="border-t border-slate-800 mt-24">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-10 mb-10">
            {/* Brand */}
            <div className="sm:col-span-2 md:col-span-1">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-indigo-400 font-bold text-lg">⚡</span>
                <span className="text-sm font-semibold text-slate-100">GTM Engine</span>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed mb-3">
                AI-powered go-to-market platform for B2B marketing and sales teams.
              </p>
              <a
                href="https://qubitlyventures.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-slate-600 hover:text-slate-400 transition-colors"
              >
                by Qubitly Ventures
              </a>
            </div>

            {/* Resources */}
            <div>
              <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-4">Resources</h4>
              <ul className="space-y-2.5">
                <li>
                  <Link href="/blog" className="text-sm text-slate-500 hover:text-slate-300 transition-colors">
                    Blog
                  </Link>
                </li>
                <li>
                  <Link href="/faq" className="text-sm text-slate-500 hover:text-slate-300 transition-colors">
                    FAQ
                  </Link>
                </li>
                <li>
                  <Link href="/signup" className="text-sm text-slate-500 hover:text-slate-300 transition-colors">
                    Get started free
                  </Link>
                </li>
              </ul>
            </div>

            {/* Company */}
            <div>
              <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-4">Company</h4>
              <ul className="space-y-2.5">
                <li>
                  <a
                    href="https://qubitlyventures.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-slate-500 hover:text-slate-300 transition-colors"
                  >
                    Qubitly Ventures
                  </a>
                </li>
              </ul>
            </div>

            {/* Legal */}
            <div>
              <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-4">Legal</h4>
              <ul className="space-y-2.5">
                <li>
                  <Link href="/privacy" className="text-sm text-slate-500 hover:text-slate-300 transition-colors">
                    Privacy Policy
                  </Link>
                </li>
                <li>
                  <Link href="/terms" className="text-sm text-slate-500 hover:text-slate-300 transition-colors">
                    Terms of Service
                  </Link>
                </li>
              </ul>
            </div>
          </div>

          {/* Bottom bar */}
          <div className="border-t border-slate-800 pt-6 flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-xs text-slate-600">
              © 2026 Qubitly Ventures LLP. All rights reserved.
            </p>
            <p className="text-xs text-slate-700">
              contact@qubitlyventures.com
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}
