import React, { useEffect, useState } from 'react'

/**
 * Fancy loading state shown while the dashboard fetches from Nookal.
 *
 * Cycles through stage messages on a timer to give the user a sense of
 * progress while the (parallel) backend calls run. Stages are advisory,
 * not tied to real backend events — a fetch typically takes 2–5s fresh
 * and 1ms from cache.
 *
 * Designed to be self-contained: drop in anywhere with
 *   <FetchProgress clinicName="Newport" />
 * while the parent holds `loading = true`.
 */

const TEAL = '#0f6e56'
const NAVY = '#1a1a2e'

interface Stage {
  at:       number    // ms since start
  primary:  string    // main line
  sub?:     string    // optional sub-line
}

const STAGES: Stage[] = [
  { at:    0, primary: 'Connecting to Nookal…' },
  { at:  500, primary: 'Fetching invoices',       sub: 'Collecting all 5 weeks' },
  { at: 1500, primary: 'Processing Week 1 of 5',  sub: 'Consultations + Inventory' },
  { at: 2300, primary: 'Processing Week 2 of 5' },
  { at: 3000, primary: 'Processing Week 3 of 5' },
  { at: 3700, primary: 'Processing Week 4 of 5' },
  { at: 4400, primary: 'Processing Remainder',    sub: 'Calculating monthly totals' },
  { at: 5500, primary: 'Almost there…',           sub: 'Tallying insurance receipts' },
]

function useCurrentStage(active: boolean): Stage {
  const [stage, setStage] = useState<Stage>(STAGES[0])

  useEffect(() => {
    if (!active) { setStage(STAGES[0]); return }
    const started = Date.now()
    const tick = () => {
      const elapsed = Date.now() - started
      // find the last stage whose `at` ≤ elapsed
      let next = STAGES[0]
      for (const s of STAGES) if (s.at <= elapsed) next = s
      setStage(next)
    }
    tick()
    const id = window.setInterval(tick, 250)
    return () => window.clearInterval(id)
  }, [active])

  return stage
}

interface Props {
  active:      boolean
  clinicName?: string
}

export default function FetchProgress({ active, clinicName }: Props) {
  const stage = useCurrentStage(active)
  if (!active) return null

  return (
    <div style={container}>
      <style>{keyframes}</style>

      {/* Shimmer bar at the top edge */}
      <div style={shimmerBar}>
        <div style={shimmerFill} />
      </div>

      <div style={{ padding: '72px 28px 88px' }}>
        {/* Ring spinner with pulsing teal core */}
        <div style={ringWrap}>
          <div style={ringOuter} />
          <div style={ringInner} />
          <div style={ringDot}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={TEAL} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 12a8 8 0 1 1-2.34-5.66" />
              <path d="M20 4v4h-4" />
            </svg>
          </div>
        </div>

        <div style={headline}>Fetching from Nookal</div>
        {clinicName && (
          <div style={clinicLine}>
            for <span style={clinicEmphasis}>{clinicName}</span>
          </div>
        )}

        {/* Stage message — keyed so the fade re-runs on every change */}
        <div key={stage.primary} style={stagePrimary}>{stage.primary}</div>
        <div key={stage.sub ?? 'empty'} style={stageSub}>{stage.sub ?? ' '}</div>

        <div style={dotsRow}>
          <span style={{ ...dot, animationDelay: '0s'    }} />
          <span style={{ ...dot, animationDelay: '0.15s' }} />
          <span style={{ ...dot, animationDelay: '0.3s'  }} />
        </div>
      </div>
    </div>
  )
}

// ── styles ─────────────────────────────────────────────────────────

const container: React.CSSProperties = {
  position: 'relative',
  background: '#fff',
  borderRadius: 12,
  border: '1px solid #e5e7eb',
  overflow: 'hidden',
  textAlign: 'center',
  animation: 'fp-enter 0.25s ease',
}

const shimmerBar: React.CSSProperties = {
  position: 'absolute', top: 0, left: 0, right: 0,
  height: 3, background: '#e5e7eb', overflow: 'hidden',
}
const shimmerFill: React.CSSProperties = {
  width: '35%', height: '100%',
  background: `linear-gradient(90deg, transparent, ${TEAL}, transparent)`,
  animation: 'fp-shimmer 1.4s ease-in-out infinite',
}

const ringWrap: React.CSSProperties = {
  position: 'relative', width: 68, height: 68,
  margin: '0 auto 22px',
}
const ringOuter: React.CSSProperties = {
  position: 'absolute', inset: 0,
  border: `3px solid ${TEAL}20`,
  borderTopColor: TEAL,
  borderRadius: '50%',
  animation: 'fp-spin 1.1s linear infinite',
}
const ringInner: React.CSSProperties = {
  position: 'absolute', inset: 10,
  border: `2px solid ${TEAL}15`,
  borderBottomColor: TEAL,
  borderRadius: '50%',
  animation: 'fp-spin 1.8s linear infinite reverse',
}
const ringDot: React.CSSProperties = {
  position: 'absolute', inset: 0,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  animation: 'fp-pulse 1.6s ease-in-out infinite',
}

const headline: React.CSSProperties = {
  fontSize: 16, fontWeight: 600, color: NAVY,
  letterSpacing: '-0.01em',
}
const clinicLine: React.CSSProperties = {
  fontSize: 13, color: '#6b7280', marginTop: 4,
}
const clinicEmphasis: React.CSSProperties = {
  color: TEAL, fontWeight: 600,
}

const stagePrimary: React.CSSProperties = {
  marginTop: 28,
  fontSize: 13, fontWeight: 500, color: '#374151',
  minHeight: 20,
  animation: 'fp-fade 0.35s ease',
}
const stageSub: React.CSSProperties = {
  marginTop: 4,
  fontSize: 12, color: '#9ca3af',
  minHeight: 18,
  animation: 'fp-fade 0.35s ease',
}

const dotsRow: React.CSSProperties = {
  marginTop: 22,
  display: 'inline-flex', gap: 6,
}
const dot: React.CSSProperties = {
  width: 6, height: 6, borderRadius: '50%',
  background: TEAL,
  display: 'inline-block',
  animation: 'fp-bounce 1s ease-in-out infinite',
}

const keyframes = `
  @keyframes fp-spin   { to { transform: rotate(360deg) } }
  @keyframes fp-pulse  { 0%,100% { transform: scale(1); opacity: 0.9 } 50% { transform: scale(1.12); opacity: 1 } }
  @keyframes fp-shimmer{ 0% { transform: translateX(-120%) } 100% { transform: translateX(380%) } }
  @keyframes fp-fade   { from { opacity: 0; transform: translateY(4px) } to { opacity: 1; transform: none } }
  @keyframes fp-enter  { from { opacity: 0; transform: translateY(6px) } to { opacity: 1; transform: none } }
  @keyframes fp-bounce { 0%,80%,100% { transform: translateY(0); opacity: 0.4 } 40% { transform: translateY(-5px); opacity: 1 } }
`
