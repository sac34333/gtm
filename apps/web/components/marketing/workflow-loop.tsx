import { Radar, Wand2, Users, Zap, ArrowRight } from 'lucide-react'

const STEPS = [
  {
    icon: Radar,
    title: 'Signals',
    tags: ['Themes', 'Trends', 'Scored'],
    body: 'Tuned to your business and themes — refreshed daily.',
  },
  {
    icon: Wand2,
    title: 'Content',
    tags: ['Image', 'Video', 'Copy'],
    body: 'No prompt fatigue — pick a tag, refine, regenerate.',
  },
  {
    icon: Users,
    title: 'ICP',
    tags: ['AI search', 'Enriched', 'Fit 0–100'],
    body: 'Real prospects matched to how you actually sell.',
  },
  {
    icon: Zap,
    title: 'Campaigns',
    tags: ['Multi-channel', '1–90 days', 'Per-prospect'],
    body: 'A full plan — calendar, briefs, personalised copy.',
  },
]

export function WorkflowLoop() {
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-md p-5 space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">How it flows</p>
        <p className="text-[11px] uppercase tracking-[0.18em] text-indigo-300/80">One loop</p>
      </div>

      {/* Horizontal flow on md+, stacked on mobile */}
      <div className="hidden md:flex items-stretch gap-1.5 w-full">
        {STEPS.map(({ icon: Icon, title, tags }, idx) => (
          <div key={title} className="flex items-center flex-1 min-w-0">
            <div className="flex-1 min-w-0 rounded-xl border border-white/[0.08] bg-gradient-to-br from-white/[0.04] to-white/[0.01] p-2.5 space-y-2 overflow-hidden">
              <div className="flex items-center gap-1.5 min-w-0">
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500/25 via-violet-500/25 to-fuchsia-500/25 border border-white/[0.08]">
                  <Icon className="h-3 w-3 text-indigo-200" />
                </div>
                <p className="text-[12px] font-medium text-slate-100 leading-tight">{title}</p>
              </div>
              <div className="flex flex-wrap gap-1">
                {tags.map((t) => (
                  <span
                    key={t}
                    className="text-[9px] px-1.5 py-0.5 rounded-md bg-white/[0.04] border border-white/[0.06] text-slate-400 whitespace-nowrap"
                  >
                    {t}
                  </span>
                ))}
              </div>
            </div>
            {idx < STEPS.length - 1 && (
              <ArrowRight
                className="h-3 w-3 mx-0.5 text-indigo-300/60 shrink-0 animate-pulse"
                strokeWidth={2.5}
              />
            )}
          </div>
        ))}
      </div>

      {/* Stacked on mobile */}
      <div className="md:hidden space-y-3">
        {STEPS.map(({ icon: Icon, title, tags, body }) => (
          <div
            key={title}
            className="rounded-xl border border-white/[0.08] bg-gradient-to-br from-white/[0.04] to-white/[0.01] p-3 space-y-2"
          >
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500/25 via-violet-500/25 to-fuchsia-500/25 border border-white/[0.08]">
                <Icon className="h-3.5 w-3.5 text-indigo-200" />
              </div>
              <p className="text-[13px] font-medium text-slate-100">{title}</p>
            </div>
            <p className="text-[11.5px] text-slate-500">{body}</p>
            <div className="flex flex-wrap gap-1">
              {tags.map((t) => (
                <span
                  key={t}
                  className="text-[9.5px] px-1.5 py-0.5 rounded-md bg-white/[0.04] border border-white/[0.06] text-slate-400"
                >
                  {t}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="pt-2 border-t border-white/[0.05]">
        <p className="text-[12.5px] text-slate-300 leading-relaxed">
          The work a marketing team normally does over weeks - delivered end-to-end, in one loop that
          learns and refines as you go.
        </p>
      </div>
    </div>
  )
}
