import React from 'react'

const TEAL      = '#0f6e56'
const TEXT      = '#111827'
const TEXT_SOFT = '#4b5563'
const BORDER    = '#e5e7eb'

interface Props {
  total:    number
  limit:    number
  offset:   number
  onChange: (offset: number) => void
  /** Optional: change the page size. */
  onLimitChange?: (limit: number) => void
  pageSizes?: number[]
}

export default function Pagination({
  total, limit, offset, onChange, onLimitChange,
  pageSizes = [25, 50, 100, 200],
}: Props) {
  const page       = Math.floor(offset / limit) + 1
  const totalPages = Math.max(1, Math.ceil(total / limit))
  const fromN      = total === 0 ? 0 : offset + 1
  const toN        = Math.min(offset + limit, total)

  const goPrev = () => onChange(Math.max(0, offset - limit))
  const goNext = () => onChange(Math.min((totalPages - 1) * limit, offset + limit))
  const goFirst = () => onChange(0)
  const goLast  = () => onChange((totalPages - 1) * limit)

  const disablePrev = offset <= 0
  const disableNext = offset + limit >= total

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '10px 14px', borderTop: `1px solid ${BORDER}`, background: '#fafbfc',
      fontSize: 12, color: TEXT_SOFT, gap: 12, flexWrap: 'wrap',
    }}>
      <div>
        Showing <strong style={{ color: TEXT }}>{fromN.toLocaleString()}–{toN.toLocaleString()}</strong>{' '}
        of <strong style={{ color: TEXT }}>{total.toLocaleString()}</strong>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {onLimitChange && (
          <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>Rows per page:</span>
            <select
              value={limit}
              onChange={(e) => onLimitChange(Number(e.target.value))}
              style={{
                padding: '4px 6px', border: `1px solid ${BORDER}`, borderRadius: 6,
                fontSize: 12, fontFamily: "'DM Sans', sans-serif", background: '#fff',
              }}
            >
              {pageSizes.map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
        )}

        <span style={{ marginLeft: 6 }}>
          Page <strong style={{ color: TEXT }}>{page}</strong> of <strong style={{ color: TEXT }}>{totalPages}</strong>
        </span>

        <div style={{ display: 'flex', gap: 4, marginLeft: 6 }}>
          <NavBtn label="«" onClick={goFirst} disabled={disablePrev} />
          <NavBtn label="‹ Prev" onClick={goPrev} disabled={disablePrev} />
          <NavBtn label="Next ›" onClick={goNext} disabled={disableNext} />
          <NavBtn label="»" onClick={goLast} disabled={disableNext} />
        </div>
      </div>
    </div>
  )
}

function NavBtn({ label, onClick, disabled }: { label: string; onClick: () => void; disabled: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        background: disabled ? '#f3f4f6' : '#fff',
        color:      disabled ? '#9ca3af' : TEAL,
        border:     `1px solid ${BORDER}`,
        borderRadius: 6,
        padding:    '4px 10px',
        fontSize:   12,
        fontWeight: 500,
        cursor:     disabled ? 'not-allowed' : 'pointer',
        fontFamily: "'DM Sans', sans-serif",
      }}
    >
      {label}
    </button>
  )
}
