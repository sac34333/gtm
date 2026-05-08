import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const alt = 'GTM Engine — AI-Powered Go-to-Market Platform'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          background: 'linear-gradient(135deg, #09090f 0%, #0f0a2e 50%, #0d0d1a 100%)',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '60px 80px',
          position: 'relative',
        }}
      >
        {/* Grid overlay */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage:
              'linear-gradient(rgba(99,102,241,0.07) 1px, transparent 1px), linear-gradient(90deg, rgba(99,102,241,0.07) 1px, transparent 1px)',
            backgroundSize: '48px 48px',
          }}
        />

        {/* Glow orb */}
        <div
          style={{
            position: 'absolute',
            top: '-80px',
            left: '50%',
            transform: 'translateX(-50%)',
            width: '600px',
            height: '400px',
            borderRadius: '50%',
            background: 'radial-gradient(ellipse, rgba(99,102,241,0.25) 0%, transparent 70%)',
          }}
        />

        {/* Logo mark + name */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '24px', zIndex: 1 }}>
          <div
            style={{
              width: '72px',
              height: '72px',
              borderRadius: '20px',
              background: 'rgba(99,102,241,0.2)',
              border: '1.5px solid rgba(99,102,241,0.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '40px',
            }}
          >
            ⚡
          </div>
          <span
            style={{
              fontSize: '64px',
              fontWeight: 900,
              color: '#ffffff',
              letterSpacing: '-1px',
            }}
          >
            GTM Engine
          </span>
        </div>

        {/* Tagline */}
        <p
          style={{
            fontSize: '28px',
            color: '#94a3b8',
            margin: '0 0 48px 0',
            textAlign: 'center',
            zIndex: 1,
            maxWidth: '700px',
          }}
        >
          AI-powered go-to-market platform for B2B teams
        </p>

        {/* Feature pills */}
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center', zIndex: 1 }}>
          {[
            'Campaign Builder',
            'Prospect Enrichment',
            'LinkedIn Posting',
            'AI Asset Generation',
            'Campaign Ask',
          ].map((feat) => (
            <div
              key={feat}
              style={{
                background: 'rgba(99,102,241,0.15)',
                border: '1px solid rgba(99,102,241,0.35)',
                borderRadius: '8px',
                padding: '10px 20px',
                color: '#a5b4fc',
                fontSize: '18px',
                fontWeight: 500,
              }}
            >
              {feat}
            </div>
          ))}
        </div>

        {/* Bottom brand attribution */}
        <div
          style={{
            position: 'absolute',
            bottom: '32px',
            right: '48px',
            fontSize: '16px',
            color: '#475569',
            zIndex: 1,
          }}
        >
          by Qubitly Ventures
        </div>
      </div>
    ),
    size,
  )
}
