import React, { useEffect, useRef, useState } from 'react'
import { usePromptStore } from '../../store/prompt.store'

const TEAL   = '#0f6e56'
const TEXT   = '#111827'
const TEXT_SOFT = '#4b5563'
const BORDER = '#e5e7eb'
const DANGER = '#b91c1c'

export default function PromptDialog() {
  const { current, resolve } = usePromptStore()
  const inputRef = useRef<HTMLInputElement>(null)

  const [value, setValue]   = useState('')
  const [error, setError]   = useState<string | null>(null)
  const [showPwd, setShowPwd] = useState(false)

  // Reset state whenever a new dialog opens.
  useEffect(() => {
    if (current) {
      setValue(current.defaultValue ?? '')
      setError(null)
      setShowPwd(false)
      const t = setTimeout(() => inputRef.current?.focus(), 30)
      return () => clearTimeout(t)
    }
  }, [current?.id])

  // Esc cancels.
  useEffect(() => {
    if (!current) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); resolve(null) }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [current, resolve])

  if (!current) return null

  const {
    title, message, inputType = 'text', placeholder,
    confirmLabel = 'Submit', cancelLabel = 'Cancel', validate,
  } = current

  const onChange = (v: string) => {
    setValue(v)
    if (error) setError(validate?.(v) ?? null)
  }

  const onSubmit = () => {
    const err = validate?.(value)
    if (err) { setError(err); return }
    resolve(value)
  }

  const isPwd = inputType === 'password'
  const effectiveType = isPwd && !showPwd ? 'password' : 'text'

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="prompt-title"
      onClick={(e) => { if (e.target === e.currentTarget) resolve(null) }}
      style={{
        position: 'fixed', inset: 0, zIndex: 9100,
        background: 'rgba(15, 23, 42, 0.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16,
        animation: 'pdFadeIn 0.12s ease',
      }}
    >
      <style>{`
        @keyframes pdFadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes pdPopIn  { from { opacity: 0; transform: translateY(6px) scale(0.97) } to { opacity: 1; transform: none } }
        .pd-input:focus { outline: none; border-color: ${TEAL} !important; box-shadow: 0 0 0 3px rgba(15,110,86,0.12) }
      `}</style>

      <form
        onSubmit={(e) => { e.preventDefault(); onSubmit() }}
        style={{
          background: '#fff', borderRadius: 12,
          width: '100%', maxWidth: 440,
          boxShadow: '0 20px 50px rgba(0,0,0,0.20)',
          animation: 'pdPopIn 0.16s ease',
          overflow: 'hidden',
          fontFamily: "'DM Sans', sans-serif",
        }}>
        <div style={{ padding: '22px 24px 4px' }}>
          <h3 id="prompt-title" style={{
            margin: 0, fontSize: 16, fontWeight: 700, color: TEXT, lineHeight: 1.3,
          }}>{title}</h3>
          {message && (
            <p style={{
              margin: '6px 0 0', fontSize: 13, color: TEXT_SOFT, lineHeight: 1.5,
              whiteSpace: 'pre-wrap',
            }}>{message}</p>
          )}
        </div>

        <div style={{ padding: '14px 24px 6px' }}>
          <div style={{ position: 'relative' }}>
            <input
              ref={inputRef}
              className="pd-input"
              type={effectiveType}
              value={value}
              placeholder={placeholder}
              onChange={(e) => onChange(e.target.value)}
              autoComplete={isPwd ? 'new-password' : 'off'}
              style={{
                width: '100%',
                padding: isPwd ? '11px 64px 11px 14px' : '11px 14px',
                border: `1px solid ${error ? '#fecaca' : BORDER}`,
                borderRadius: 8,
                fontSize: 14, fontFamily: "'DM Sans', sans-serif",
                color: TEXT, boxSizing: 'border-box',
                background: '#fff',
                transition: 'border-color 0.15s, box-shadow 0.15s',
              }}
            />
            {isPwd && (
              <button
                type="button"
                onClick={() => setShowPwd(s => !s)}
                tabIndex={-1}
                style={{
                  position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                  background: 'transparent', border: 'none', color: TEXT_SOFT,
                  fontSize: 12, fontWeight: 500, cursor: 'pointer',
                  fontFamily: "'DM Sans', sans-serif", padding: '4px 8px',
                }}
              >{showPwd ? 'Hide' : 'Show'}</button>
            )}
          </div>
          {error && (
            <div style={{ marginTop: 6, fontSize: 12, color: DANGER }}>{error}</div>
          )}
        </div>

        <div style={{
          padding: '12px 18px', borderTop: `1px solid ${BORDER}`, background: '#fafbfc',
          display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 10,
        }}>
          <button
            type="button"
            onClick={() => resolve(null)}
            style={{
              background: '#fff', color: TEXT,
              border: `1px solid ${BORDER}`, borderRadius: 7,
              padding: '8px 16px', fontSize: 13, fontWeight: 500,
              cursor: 'pointer', fontFamily: "'DM Sans', sans-serif",
            }}
          >{cancelLabel}</button>
          <button
            type="submit"
            style={{
              background: TEAL, color: '#fff',
              border: 'none', borderRadius: 7,
              padding: '8px 18px', fontSize: 13, fontWeight: 600,
              cursor: 'pointer', fontFamily: "'DM Sans', sans-serif",
              boxShadow: '0 1px 3px rgba(15,110,86,0.25)',
            }}
          >{confirmLabel}</button>
        </div>
      </form>
    </div>
  )
}
