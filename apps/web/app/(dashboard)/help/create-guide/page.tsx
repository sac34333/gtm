import Link from 'next/link'
import { BackButton } from '@/components/layout/back-button'

// Static guide — Server Component, no data fetching needed.

function Section({ id, emoji, title, subtitle, children }: {
  id?: string
  emoji: string
  title: string
  subtitle?: string
  children: React.ReactNode
}) {
  return (
    <section id={id} className="scroll-mt-20">
      <div className="flex items-start gap-3 mb-4">
        <span className="text-2xl shrink-0">{emoji}</span>
        <div>
          <h2 className="text-lg font-semibold text-slate-100">{title}</h2>
          {subtitle && <p className="text-sm text-slate-400 mt-0.5">{subtitle}</p>}
        </div>
      </div>
      <div className="pl-10">{children}</div>
    </section>
  )
}

function Chip({ label, dim = false }: { label: string; dim?: boolean }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs border font-medium
      ${dim
        ? 'bg-slate-800 border-slate-700 text-slate-500'
        : 'bg-sky-500/15 border-sky-500/40 text-sky-300'
      }`}>
      {label}
    </span>
  )
}

function ChipRow({ chips }: { chips: string[] }) {
  return (
    <div className="flex flex-wrap gap-2 mb-3">
      {chips.map(c => <Chip key={c} label={c} />)}
    </div>
  )
}

function InfoBox({ type, children }: { type: 'tip' | 'note'; children: React.ReactNode }) {
  const styles = type === 'tip'
    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
    : 'bg-indigo-500/10 border-indigo-500/30 text-indigo-300'
  const icon = type === 'tip' ? '💡' : 'ℹ️'
  return (
    <div className={`flex gap-3 rounded-xl border px-4 py-3 text-sm mt-3 ${styles}`}>
      <span className="shrink-0 mt-0.5">{icon}</span>
      <div>{children}</div>
    </div>
  )
}

function Divider() {
  return <div className="border-t border-slate-800 my-8" />
}

function TableRow({ label, desc }: { label: string; desc: string }) {
  return (
    <tr className="border-t border-slate-800">
      <td className="py-2.5 pr-4 text-sm font-medium text-slate-200 whitespace-nowrap w-36 align-top">{label}</td>
      <td className="py-2.5 text-sm text-slate-400">{desc}</td>
    </tr>
  )
}

export default function CreateGuidePage() {
  return (
    <div className="min-h-screen">
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-0">
        <BackButton href="/create" label="Back to Create" />

        {/* Header */}
        <div className="mb-10 mt-2">
          <h1 className="text-3xl font-bold gtm-title tracking-tight mb-2">
            Creating great AI assets — a quick guide
          </h1>
          <p className="text-slate-400 text-base leading-relaxed">
            Everything you need to know about each field on the Create page, written in plain English.
            No prompt engineering experience needed.
          </p>
        </div>

        {/* Table of contents */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 mb-10">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">On this page</p>
          <ol className="space-y-1.5 text-sm">
            {[
              ['#subject', '1. Subject — what your asset is about'],
              ['#creative-direction', '2. Creative direction — directing the AI'],
              ['#image-chips', '3. Image preset chips explained'],
              ['#video-chips', '4. Video preset chips explained'],
              ['#visual-style', '5. Visual style'],
              ['#mood', '6. Mood'],
              ['#platform', '7. Platform & aspect ratio'],
              ['#cta', '8. Call to action overlay'],
              ['#brand-tip', '9. Why brand details matter (the most important tip!)'],
            ].map(([href, label]) => (
              <li key={href}>
                <a href={href} className="text-indigo-400 hover:text-indigo-300 hover:underline transition-colors">
                  {label}
                </a>
              </li>
            ))}
          </ol>
        </div>

        <div className="space-y-10">

          {/* 1 — Subject */}
          <Section id="subject" emoji="🎯" title="Subject" subtitle="The one thing your image or video must communicate">
            <p className="text-sm text-slate-400 leading-relaxed mb-3">
              The subject is the core message — think of it as the caption you would write if there were no image at all.
              The AI uses this as the anchor for everything it generates.
            </p>
            <div className="bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-3 space-y-2">
              <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">Good examples</p>
              <p className="text-sm text-slate-300 italic">"AI is changing how sales teams prioritise leads"</p>
              <p className="text-sm text-slate-300 italic">"We help CFOs reduce month-end close from 10 days to 3"</p>
              <p className="text-sm text-slate-300 italic">"Our new integration with Salesforce is live"</p>
            </div>
            <InfoBox type="tip">
              Keep the subject to one clear idea. If you have two ideas, create two separate assets — one for each.
            </InfoBox>
          </Section>

          <Divider />

          {/* 2 — Creative direction */}
          <Section
            id="creative-direction"
            emoji="🎬"
            title="Creative direction"
            subtitle="Extra instructions — like briefing a creative director on set"
          >
            <p className="text-sm text-slate-400 leading-relaxed mb-4">
              This is where you tell the AI <em>how</em> to visualise your subject — the scene, lighting, camera,
              people, text overlays, and mood. You can either click the preset chips below the label,
              or type your own description. You can do both at the same time.
            </p>

            <p className="text-sm font-semibold text-slate-300 mb-2">The golden rule for images</p>
            <div className="bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-sm text-slate-300 mb-4">
              <span className="text-slate-500 mr-1">Formula:</span>
              <strong>[Subject]</strong> + <strong>[Action or state]</strong> + <strong>[Location/context]</strong> + <strong>[Composition]</strong> + <strong>[Style]</strong>
              <p className="mt-2 text-slate-400 italic">"A glowing dashboard interface on a dark monitor, centred frame, modern open office at dusk, golden-hour rim light, premium SaaS photography."</p>
            </div>

            <p className="text-sm font-semibold text-slate-300 mb-2">The golden rule for videos</p>
            <div className="bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-sm text-slate-300 mb-4">
              <span className="text-slate-500 mr-1">Formula:</span>
              <strong>[Camera movement]</strong> + <strong>[Subject]</strong> + <strong>[Action]</strong> + <strong>[Setting]</strong> + <strong>[Style & Ambiance]</strong>
              <p className="mt-2 text-slate-400 italic">"Slow dolly-in toward a confident executive opening a laptop. Modern glass boardroom. Warm cinematic grade. SFX: distant keyboard taps."</p>
            </div>

            <InfoBox type="note">
              The preset chips write the creative direction text for you — just click to select. Multiple chips can be
              active at once. Click an active (blue) chip again to remove it.
            </InfoBox>

            <InfoBox type="tip">
              For dialogue or exact text in a video, use quotation marks:
              <span className="block mt-1 font-mono text-xs text-emerald-200">'A confident voice says, "This changes everything."'</span>
            </InfoBox>
          </Section>

          <Divider />

          {/* 3 — Image chips */}
          <Section
            id="image-chips"
            emoji="🖼️"
            title="Image preset chips — explained"
            subtitle="These appear when you are creating an image"
          >
            <div className="space-y-7">

              <div>
                <p className="text-sm font-semibold text-slate-200 mb-2">Scene chips</p>
                <p className="text-xs text-slate-500 mb-3">Sets the physical environment and background of the image.</p>
                <div className="space-y-2.5">
                  {[
                    ['🖥️ Dashboard UI', 'A sleek product interface glowing on a monitor — perfect for SaaS and software products.'],
                    ['🌆 City at dusk', 'Floor-to-ceiling windows, warm city skyline backdrop — conveys ambition and scale.'],
                    ['🗂️ Desk flat-lay', 'Top-down overhead view of a clean desk — great for productivity and operations themes.'],
                    ['🔵 Abstract data', 'Flowing data streams and nodes on dark navy — ideal for AI, analytics, and tech topics.'],
                    ['🏢 Boardroom', 'Clean modern boardroom, no people — a neutral, professional, executive-level backdrop.'],
                  ].map(([label, desc]) => (
                    <div key={label as string} className="flex items-start gap-3">
                      <Chip label={label as string} />
                      <p className="text-xs text-slate-400 pt-1 leading-relaxed">{desc as string}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-sm font-semibold text-slate-200 mb-2">Lighting chips</p>
                <p className="text-xs text-slate-500 mb-3">Controls the feel and atmosphere through light quality and direction.</p>
                <div className="space-y-2.5">
                  {[
                    ['💡 Studio softbox', 'Even, clean studio lighting with soft shadows — like a professional product shoot.'],
                    ['🌅 Golden hour', 'Warm, golden-toned backlight from a low sun — cinematic and aspirational.'],
                    ['🎭 Chiaroscuro', 'High contrast — bright focal point, dramatic dark shadows. Bold and authoritative.'],
                    ['🔆 Neon ambient', 'Soft neon glow in your brand colour — moody, tech-forward atmosphere.'],
                  ].map(([label, desc]) => (
                    <div key={label as string} className="flex items-start gap-3">
                      <Chip label={label as string} />
                      <p className="text-xs text-slate-400 pt-1 leading-relaxed">{desc as string}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-sm font-semibold text-slate-200 mb-2">Text &amp; Headlines chips</p>
                <p className="text-xs text-slate-500 mb-3">Controls whether and how text appears in the image itself.</p>
                <div className="space-y-2.5">
                  {[
                    ['📢 Bold top headline', 'Large white headline at the top. Use the CTA field (below the form) to set the actual words.'],
                    ['🏷️ Bottom CTA strip', 'A horizontal coloured strip at the bottom with call-to-action text. Works well for ads.'],
                    ['🔤 Wordmark only', 'A small, subtle brand name or logo in the corner — clean and uncluttered.'],
                    ['🗒️ No text', 'Purely visual image with no words, labels, or captions. Great for organic social.'],
                  ].map(([label, desc]) => (
                    <div key={label as string} className="flex items-start gap-3">
                      <Chip label={label as string} />
                      <p className="text-xs text-slate-400 pt-1 leading-relaxed">{desc as string}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-sm font-semibold text-slate-200 mb-2">Composition chips</p>
                <p className="text-xs text-slate-500 mb-3">Controls the layout and framing — where things sit in the frame.</p>
                <div className="space-y-2.5">
                  {[
                    ['🎯 Centre focus', 'Single subject dead-centre with lots of empty space around it — clean and minimal.'],
                    ['📐 Rule of thirds', 'Subject on the left, open space on the right — useful if you plan to overlay text.'],
                    ['🔭 Wide angle', 'Expansive view that shows the full environment and conveys a sense of scale.'],
                    ['🔬 Macro close-up', 'Extreme zoom-in on one detail with soft background blur — dramatic and striking.'],
                  ].map(([label, desc]) => (
                    <div key={label as string} className="flex items-start gap-3">
                      <Chip label={label as string} />
                      <p className="text-xs text-slate-400 pt-1 leading-relaxed">{desc as string}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-sm font-semibold text-slate-200 mb-2">People chips</p>
                <p className="text-xs text-slate-500 mb-3">Controls whether people appear and what they look like.</p>
                <div className="space-y-2.5">
                  {[
                    ['👤 No people', 'No humans in the image — purely product, environment, or abstract elements.'],
                    ['👔 Exec portrait', 'A male executive in his 40s in a tailored suit. Editorial, confident, professional.'],
                    ['👩‍💼 Female founder', 'A female founder in her 30s, smart casual, natural confident posture.'],
                    ['🤝 Team shot', 'A small diverse team of three professionals in a collaborative moment.'],
                  ].map(([label, desc]) => (
                    <div key={label as string} className="flex items-start gap-3">
                      <Chip label={label as string} />
                      <p className="text-xs text-slate-400 pt-1 leading-relaxed">{desc as string}</p>
                    </div>
                  ))}
                </div>
                <InfoBox type="tip">
                  For best results with people images, also check the <strong>Photography</strong> visual style
                  and choose a <strong>Mood</strong> that matches the emotion you want the person to convey.
                </InfoBox>
              </div>
            </div>
          </Section>

          <Divider />

          {/* 4 — Video chips */}
          <Section
            id="video-chips"
            emoji="🎥"
            title="Video preset chips — explained"
            subtitle="These appear when you switch to Video mode"
          >
            <p className="text-sm text-slate-400 leading-relaxed mb-5">
              Video prompts work differently from image prompts — the <strong className="text-slate-200">camera movement always comes first</strong>.
              Think of yourself as a film director briefing your camera operator. Use the Camera and Shot type chips
              first, then Audio and Pacing to complete the feel.
            </p>

            <div className="space-y-7">

              <div>
                <p className="text-sm font-semibold text-slate-200 mb-2">Camera movement chips</p>
                <p className="text-xs text-slate-500 mb-3">How the camera physically moves during the clip.</p>
                <div className="space-y-2.5">
                  {[
                    ['🎬 Slow dolly in', 'Camera glides slowly toward the subject. Creates intimacy and focus. Great for product reveals.'],
                    ['📸 Tracking shot', 'Camera follows alongside a moving subject. Adds energy and forward momentum.'],
                    ['🦅 Aerial crane', 'Camera rises up and tilts down from above. Conveys scale, achievement, and panoramic vision.'],
                    ['🔄 360° orbit', 'Camera rotates around the subject in a full circle. Striking and confident — great for product showcases.'],
                    ['🎭 Push to close-up', 'Camera slowly pushes into an extreme close-up. Reveals detail and creates dramatic focus.'],
                  ].map(([label, desc]) => (
                    <div key={label as string} className="flex items-start gap-3">
                      <Chip label={label as string} />
                      <p className="text-xs text-slate-400 pt-1 leading-relaxed">{desc as string}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-sm font-semibold text-slate-200 mb-2">Shot type chips</p>
                <p className="text-xs text-slate-500 mb-3">How far the camera is from the subject — sets the scale of the frame.</p>
                <div className="space-y-2.5">
                  {[
                    ['🖼️ Wide establishing', 'Full environment visible. Shows context and surroundings. Use at the start of a sequence.'],
                    ['👤 Medium shot', 'Frames a person from waist up. Neutral and grounded — the most natural perspective.'],
                    ['🔍 Extreme close-up', 'Zoomed all the way in on one detail — a product surface, hands, or a screen. Dramatic.'],
                    ['📐 Low angle', 'Looking up at the subject. Makes it feel powerful, imposing, and authoritative.'],
                    ['👁️ POV', 'You are the subject — first-person perspective. Immersive and engaging.'],
                  ].map(([label, desc]) => (
                    <div key={label as string} className="flex items-start gap-3">
                      <Chip label={label as string} />
                      <p className="text-xs text-slate-400 pt-1 leading-relaxed">{desc as string}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-sm font-semibold text-slate-200 mb-2">Audio chips</p>
                <p className="text-xs text-slate-500 mb-3">Controls the sound in the video — dialogue, sound effects, or music.</p>
                <div className="space-y-2.5">
                  {[
                    ['🔇 Silent', 'No dialogue or voiceover. Pure visuals with only subtle ambient texture.'],
                    ['🎵 Ambient sound', 'Office ambience — gentle air conditioning, distant keyboard taps, soft background murmur. Natural and professional.'],
                    ['💬 Voiceover', 'A confident voice speaks a short line. Use the creative direction box to specify the exact words in quotes.'],
                    ['🔊 UI sound FX', 'Crisp interface interaction sounds — clicks, swooshes, notification chimes. Perfect for SaaS demos.'],
                    ['🎼 Cinematic score', 'Minimal underscore music that builds and resolves. Adds emotional arc to short clips.'],
                  ].map(([label, desc]) => (
                    <div key={label as string} className="flex items-start gap-3">
                      <Chip label={label as string} />
                      <p className="text-xs text-slate-400 pt-1 leading-relaxed">{desc as string}</p>
                    </div>
                  ))}
                </div>
                <InfoBox type="tip">
                  To specify exact voiceover words, add them in the creative direction box using quotes:
                  <span className="block mt-1 font-mono text-xs text-emerald-200">'A calm voice says, "Your pipeline. Automated."'</span>
                </InfoBox>
              </div>

              <div>
                <p className="text-sm font-semibold text-slate-200 mb-2">Pacing chips</p>
                <p className="text-xs text-slate-500 mb-3">Controls the speed and rhythm of the motion in the clip.</p>
                <div className="space-y-2.5">
                  {[
                    ['💫 Slow motion', '60% slow motion — draws attention to texture, detail, and subtle motion. Elegant and luxurious.'],
                    ['⚡ High energy', 'Fast-paced camera movements and quick reveals. Dynamic and exciting — suits bold or launch content.'],
                    ['🌊 Smooth float', 'Weightless, gravity-defying motion. Everything moves slowly and gracefully — ethereal and premium.'],
                    ['⏳ Time-lapse', 'Compresses time — a busy city, a product being built, a day passing. Conveys momentum and progress.'],
                  ].map(([label, desc]) => (
                    <div key={label as string} className="flex items-start gap-3">
                      <Chip label={label as string} />
                      <p className="text-xs text-slate-400 pt-1 leading-relaxed">{desc as string}</p>
                    </div>
                  ))}
                </div>
              </div>

            </div>

            <div className="mt-6 bg-violet-500/10 border border-violet-500/30 rounded-xl px-4 py-4 text-sm text-violet-300">
              <p className="font-semibold mb-1">🎬 Image → Video (Animate)</p>
              <p className="text-violet-400 text-xs leading-relaxed">
                In your Library, every completed image has a <strong className="text-violet-200">Film icon</strong> button.
                Clicking it takes you to the Create page in video mode, with that image pre-loaded as the starting frame.
                The AI will animate your image — motion, sound, and camera movement — based on the creative direction chips you pick here.
              </p>
            </div>
          </Section>

          <Divider />

          {/* 5 — Visual style */}
          <Section id="visual-style" emoji="🎨" title="Visual style" subtitle="The overall rendering look of the asset">
            <table className="w-full text-left">
              <tbody>
                <TableRow label="📷 Photography" desc="Photorealistic. Looks like a real photograph taken with a camera. Best for people, environments, and product shots." />
                <TableRow label="✏️ Illustration" desc="Hand-drawn or vector illustration style. Warmer, more approachable, and distinctive on social feeds." />
                <TableRow label="△ Abstract" desc="Non-representational shapes, gradients, and forms. Excellent for data, AI, and technology topics." />
                <TableRow label="📦 3D Render" desc="Computer-rendered 3D objects and environments. Modern, tactile, and great for product showcases." />
                <TableRow label="▣ Flat Design" desc="Clean flat shapes with minimal shading. Simple and bold — works well for infographic-style content." />
              </tbody>
            </table>
            <InfoBox type="note">
              Visual style and creative direction work together. A <strong>Chiaroscuro lighting</strong> chip
              combined with <strong>Photography</strong> style will produce a very different result from the same lighting
              chip with <strong>Illustration</strong> style.
            </InfoBox>
          </Section>

          <Divider />

          {/* 6 — Mood */}
          <Section id="mood" emoji="🌡️" title="Mood" subtitle="The emotional register of the asset">
            <table className="w-full text-left">
              <tbody>
                <TableRow label="💼 Professional" desc="Polished, credible, corporate-appropriate. Safe choice for most B2B content." />
                <TableRow label="⚡ Bold" desc="High-energy, assertive, disruptive. Use for launch announcements or provocative statements." />
                <TableRow label="🌿 Calm" desc="Relaxed, reassuring, trusted. Works well for compliance, security, or wellness-adjacent products." />
                <TableRow label="🚀 Energetic" desc="Fast-paced, exciting, forward-looking. Great for growth-stage companies and product launches." />
                <TableRow label="◻️ Minimal" desc="Clean, quiet, understated. Signals sophistication and lets the product speak for itself." />
                <TableRow label="☀️ Warm" desc="Friendly, human, optimistic. Good for people-centric culture or community content." />
              </tbody>
            </table>
          </Section>

          <Divider />

          {/* 7 — Platform */}
          <Section id="platform" emoji="📱" title="Platform &amp; Aspect Ratio" subtitle="Which channel this asset is being made for">
            <p className="text-sm text-slate-400 leading-relaxed mb-4">
              Selecting a platform automatically sets the correct aspect ratio — but you can always override it manually in the Aspect Ratio section below.
            </p>
            <table className="w-full text-left">
              <tbody>
                <TableRow label="LinkedIn" desc="Portrait 4:5 — the dominant format in the LinkedIn feed. Taller images take more scroll space and get more views." />
                <TableRow label="Instagram" desc="Square 1:1 — standard feed post. For Stories and Reels, switch the ratio to 9:16 manually." />
                <TableRow label="Twitter / X" desc="Landscape 16:9 — fills the full card width in the timeline." />
                <TableRow label="WhatsApp" desc="Square 1:1 — used for status updates and broadcast messages." />
                <TableRow label="Generic" desc="No platform-specific constraints. Use for website hero images, pitch decks, or print materials." />
              </tbody>
            </table>
            <InfoBox type="tip">
              LinkedIn's algorithm gives more impressions to portrait images because they occupy more screen space in the feed.
              This is why <strong>Portrait 4:5</strong> is the default.
            </InfoBox>
          </Section>

          <Divider />

          {/* 8 — CTA */}
          <Section id="cta" emoji="📣" title="Call to action overlay" subtitle="A single line of text the AI will render visibly in the image">
            <p className="text-sm text-slate-400 leading-relaxed mb-3">
              This is optional. Leave it blank for a clean, text-free image. When you add a CTA,
              the AI renders that exact phrase as visible text inside the image itself — in a clean, legible typeface.
            </p>
            <div className="bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-3 space-y-2">
              <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">Examples</p>
              <p className="text-sm text-slate-300 italic">"Book a free demo →"</p>
              <p className="text-sm text-slate-300 italic">"Now live — try it free"</p>
              <p className="text-sm text-slate-300 italic">"Join 500+ teams"</p>
            </div>
            <InfoBox type="note">
              Keep your CTA to one short line — under 8 words works best. The AI will place it in the
              bottom area of the image at high contrast.
            </InfoBox>
          </Section>

          <Divider />

          {/* 9 — Brand tip */}
          <Section
            id="brand-tip"
            emoji="⭐"
            title="The most important tip: fill in your brand details"
            subtitle="This is what separates generic AI output from on-brand, professional assets"
          >
            <p className="text-sm text-slate-400 leading-relaxed mb-5">
              Every asset you generate is automatically grounded in your brand context — your company description,
              colours, themes, and audience. The more detail you provide, the more on-brand and polished your outputs will be.
            </p>

            <div className="space-y-4">
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
                <p className="text-sm font-semibold text-slate-200 mb-1">During onboarding</p>
                <p className="text-sm text-slate-400 leading-relaxed mb-3">
                  When you first sign up, the onboarding wizard asks you to describe your company, your audience,
                  your brand colours, and your tone of voice. Spending 5–10 minutes answering these carefully
                  means every single asset you generate from that point on will reflect your brand automatically —
                  without needing to repeat that information each time.
                </p>
                <Link
                  href="/onboarding"
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-indigo-400 hover:text-indigo-300 transition-colors"
                >
                  Go to onboarding →
                </Link>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
                <p className="text-sm font-semibold text-slate-200 mb-1">Via Settings → Brand</p>
                <p className="text-sm text-slate-400 leading-relaxed mb-3">
                  You can update or expand your brand details at any time. Adding more detail here
                  immediately improves the quality of every asset generated going forward.
                </p>
                <p className="text-xs text-slate-500 mb-3">Fields that make the biggest difference:</p>
                <ul className="space-y-1.5 mb-4">
                  {[
                    ['One-sentence pitch', 'What you do and who you do it for — the AI uses this as the foundation of every prompt.'],
                    ['Brand colours', 'Primary, secondary, and accent hex codes — ensures colour accuracy in every image.'],
                    ['Active themes', 'Current marketing themes (e.g. "AI-powered automation", "Enterprise security") — keeps content on-strategy.'],
                    ['Decision maker titles', 'Who your buyer is (e.g. "CFO", "Head of Sales") — informs the style of people depicted.'],
                    ['Phrases to avoid', 'Words or phrases that don\'t reflect your brand voice — the AI will steer clear.'],
                  ].map(([field, desc]) => (
                    <li key={field as string} className="flex items-start gap-2 text-sm">
                      <span className="text-emerald-400 mt-0.5 shrink-0">✓</span>
                      <span>
                        <strong className="text-slate-300">{field as string}</strong>
                        <span className="text-slate-500"> — {desc as string}</span>
                      </span>
                    </li>
                  ))}
                </ul>
                <Link
                  href="/settings/brand"
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-indigo-400 hover:text-indigo-300 transition-colors"
                >
                  Go to Settings → Brand →
                </Link>
              </div>
            </div>

            <div className="mt-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl px-5 py-4">
              <p className="text-sm font-semibold text-emerald-300 mb-1.5">What happens when you complete your brand profile</p>
              <ul className="space-y-1.5">
                {[
                  'Every generated image automatically uses your brand colours',
                  'The AI understands your company and audience without you re-explaining it each time',
                  'People depicted in images will resemble your target buyer persona',
                  'Your tone of voice and themes carry through to social captions',
                  'You save time — no need to type brand context into the creative direction box',
                ].map(item => (
                  <li key={item} className="flex items-start gap-2 text-sm text-emerald-300/90">
                    <span className="shrink-0 mt-0.5">✓</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </Section>

          <Divider />

          {/* Footer nav */}
          <div className="flex items-center justify-between pt-2 pb-8">
            <Link href="/create" className="inline-flex items-center gap-2 text-sm text-indigo-400 hover:text-indigo-300 transition-colors">
              ← Back to Create
            </Link>
            <Link href="/settings/brand" className="inline-flex items-center gap-2 text-sm text-indigo-400 hover:text-indigo-300 transition-colors">
              Update brand details →
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
