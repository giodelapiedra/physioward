import React from 'react'
import { useToastStore, ToastKind } from '../../store/toast.store'

const STYLES_BY_KIND: Record<ToastKind, { bg: string; bd: string; fg: string; icon: string }> = {
  success: { bg: '#ecfdf5', bd: '#a7f3d0', fg: '#065f46', icon: '✓' },
  error:   { bg: '#fef2f2', bd: '#fecaca', fg: '#991b1b', icon: '!' },
  info:    { bg: '#eff6ff', bd: '#bfdbfe', fg: '#1e40af', icon: 'i' },
}

export default function ToastContainer() {
  const { toasts, dismiss } = useToastStore()

  if (toasts.length === 0) return null

  return (
    <div style={{
      position: 'fixed', top: 16, right: 16,
      display: 'flex', flexDirection: 'column', gap: 8,
      zIndex: 9999, pointerEvents: 'none',
    }}>
      <style>{`
        @keyframes toastIn {
          from { opacity: 0; transform: translateX(20px) }
          to   { opacity: 1; transform: translateX(0) }
        }
      `}</style>
      {toasts.map(t => {
        const s = STYLES_BY_KIND[t.kind]
        return (
          <div key={t.id}
            style={{
              background: s.bg,
              border: `1px solid ${s.bd}`,
              color: s.fg,
              borderRadius: 10,
              padding: '11px 14px 11px 12px',
              fontSize: 13,
              fontWeight: 500,
              fontFamily: "'DM Sans', sans-serif",
              minWidth: 240, maxWidth: 360,
              boxShadow: '0 4px 16px rgba(0,0,0,0.10)',
              display: 'flex', alignItems: 'flex-start', gap: 10,
              pointerEvents: 'auto',
              animation: 'toastIn 0.2s ease',
            }}>
            <span style={{
              flexShrink: 0,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              width: 20, height: 20, borderRadius: '50%',
              background: s.fg, color: s.bg,
              fontSize: 12, fontWeight: 700,
            }}>{s.icon}</span>
            <span style={{ flex: 1, lineHeight: 1.4 }}>{t.message}</span>
            <button
              onClick={() => dismiss(t.id)}
              aria-label="Dismiss"
              style={{
                background: 'transparent', border: 'none', cursor: 'pointer',
                color: s.fg, opacity: 0.5, fontSize: 16,
                padding: 0, lineHeight: 1, marginLeft: 4,
              }}
            >×</button>
          </div>
        )
      })}
    </div>
  )
}
