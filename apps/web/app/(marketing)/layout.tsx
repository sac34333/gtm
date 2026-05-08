import Link from 'next/link'

export const runtime = 'edge'

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* Navigation */}
      <header className="sticky top-0 z-40 border-b border-slate-800 bg-slate-950/90 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link href="/blog" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
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
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <span className="text-indigo-400 font-bold">⚡</span>
            <span className="text-sm text-slate-400 font-medium">GTM Engine</span>
            <span className="text-slate-600 text-sm ml-2">
              by{' '}
              <a
                href="https://qubitlyventures.com"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-slate-400 transition-colors"
              >
                Qubitly Ventures
              </a>
            </span>
          </div>
          <nav className="flex items-center gap-6 text-sm text-slate-500">
            <Link href="/blog" className="hover:text-slate-400 transition-colors">
              Blog
            </Link>
            <Link href="/faq" className="hover:text-slate-400 transition-colors">
              FAQ
            </Link>
            <Link href="/signup" className="hover:text-slate-400 transition-colors">
              Get started
            </Link>
          </nav>
          <p className="text-xs text-slate-600">© 2026 Qubitly Ventures</p>
        </div>
      </footer>
    </div>
  )
}
