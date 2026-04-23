import React, { useState, useCallback, useEffect } from 'react'
import { DashboardData, WeekMetrics, MonthlyTotals } from '../../types'
import { dashboardApi } from '../../api/dashboard.api'
import { useAuthStore } from '../../store/auth.store'
import FetchProgress from '../common/FetchProgress'

// ── Format helpers ────────────────────────────────────────────
const fmtCurrency = (v: number) =>
  `$${v.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const fmtPct = (v: number | null) => (v === null ? '#DIV/0!' : `${v.toFixed(2)}%`)
const fmtInt = (v: number) => v === 0 ? '' : v.toString()
const fmtCurrencyOrBlank = (v: number) => v === 0 ? '' : fmtCurrency(v)

// ── Colours ───────────────────────────────────────────────────
const TEAL      = '#0f6e56'
const NAVY      = '#1a1a2e'
const NAVY_MID  = '#2d3561'
const HEADER_BG = '#1e2547'

// ── Month names ───────────────────────────────────────────────
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

// ── Clinics ───────────────────────────────────────────────────
const CLINIC_LIST = [
  { id: 'newport',   name: 'Newport'   },
  { id: 'narrabeen', name: 'Narrabeen' },
  { id: 'brookvale', name: 'Brookvale' },
]

// ── Sub-components ────────────────────────────────────────────

function SectionHeader({ label }: { label: string }) {
  return (
    <tr>
      <td style={{ background: NAVY, color: '#fff', fontWeight: 600, fontSize: 11,
        letterSpacing: '0.07em', padding: '7px 12px', textTransform: 'uppercase',
        borderTop: '2px solid #3d4a8a' }}>
        {label}
      </td>
      <td colSpan={8} style={{ background: NAVY, borderTop: '2px solid #3d4a8a' }} />
    </tr>
  )
}

type CellVal = string | number | null

function DataRow({
  label, definition, wk1, wk2, wk3, wk4, rem,
  metricType, monthly, monthlyGoal, highlight,
}: {
  label: string; definition: string
  wk1: CellVal; wk2: CellVal; wk3: CellVal; wk4: CellVal; rem: CellVal
  metricType: string; monthly: CellVal; monthlyGoal?: CellVal; highlight?: boolean
}) {
  const cellStyle = (v: CellVal): React.CSSProperties => ({
    padding: '6px 8px', fontSize: 12, textAlign: 'center',
    fontFamily: "'DM Mono', monospace",
    borderBottom: '1px solid #eef0f3',
    color: v === '#DIV/0!' ? '#ef4444' : highlight ? TEAL : '#1a1a2e',
    background: highlight ? '#f0faf7' : '#fff',
    whiteSpace: 'nowrap',
  })

  return (
    <tr>
      <td style={{
        padding: '6px 12px', fontSize: 12, fontWeight: 500, color: '#111827',
        borderBottom: '1px solid #eef0f3', background: highlight ? '#f0faf7' : '#fff',
        minWidth: 200,
      }}>{label}</td>
      <td style={{
        padding: '6px 12px', fontSize: 11, color: '#6b7280',
        borderBottom: '1px solid #eef0f3', background: highlight ? '#f0faf7' : '#fff',
      }}>{definition}</td>
      <td style={cellStyle(wk1)}>{wk1 ?? ''}</td>
      <td style={cellStyle(wk2)}>{wk2 ?? ''}</td>
      <td style={cellStyle(wk3)}>{wk3 ?? ''}</td>
      <td style={cellStyle(wk4)}>{wk4 ?? ''}</td>
      <td style={cellStyle(rem)}>{rem ?? ''}</td>
      <td style={{ ...cellStyle(metricType), fontSize: 10, color: '#9ca3af' }}>{metricType}</td>
      <td style={{ ...cellStyle(monthly), fontWeight: 600, color: highlight ? TEAL : '#111827' }}>
        {monthly ?? ''}
      </td>
      <td style={{ ...cellStyle(monthlyGoal ?? ''), color: '#9ca3af' }}>
        {monthlyGoal ?? ''}
      </td>
    </tr>
  )
}

// ── Dashboard Table ───────────────────────────────────────────
function DashboardTable({ data }: { data: DashboardData }) {
  const w = data.weeks  // [wk1, wk2, wk3, wk4, remainder]
  const m = data.monthly

  // Helper: get value from week by index (0=wk1 … 3=wk4, 4=remainder)
  const wv = (i: number, key: keyof WeekMetrics) => {
    const week = w[i]
    if (!week) return null
    return week[key] as any
  }

  // Currency row helper
  const crow = (
    label: string, def: string, key: keyof WeekMetrics,
    mKey: keyof MonthlyTotals, highlight = false
  ) => (
    <DataRow
      label={label} definition={def}
      wk1={wv(0, key) ? fmtCurrency(wv(0, key)) : ''}
      wk2={wv(1, key) ? fmtCurrency(wv(1, key)) : ''}
      wk3={wv(2, key) ? fmtCurrency(wv(2, key)) : ''}
      wk4={wv(3, key) ? fmtCurrency(wv(3, key)) : ''}
      rem={wv(4, key) ? fmtCurrency(wv(4, key)) : ''}
      metricType="Total"
      monthly={m[mKey] ? fmtCurrency(m[mKey] as number) : '$0.00'}
      highlight={highlight}
    />
  )

  // Number row helper
  const nrow = (
    label: string, def: string, key: keyof WeekMetrics,
    mKey: keyof MonthlyTotals, metricType = 'Total', highlight = false
  ) => (
    <DataRow
      label={label} definition={def}
      wk1={fmtInt(wv(0, key) ?? 0)}
      wk2={fmtInt(wv(1, key) ?? 0)}
      wk3={fmtInt(wv(2, key) ?? 0)}
      wk4={fmtInt(wv(3, key) ?? 0)}
      rem={fmtInt(wv(4, key) ?? 0)}
      metricType={metricType}
      monthly={m[mKey] !== undefined ? (m[mKey] as number).toString() : '0'}
      highlight={highlight}
    />
  )

  // Percent row helper
  const prow = (
    label: string, def: string, key: keyof WeekMetrics,
    mKey: keyof MonthlyTotals, highlight = false
  ) => (
    <DataRow
      label={label} definition={def}
      wk1={fmtPct(wv(0, key))}
      wk2={fmtPct(wv(1, key))}
      wk3={fmtPct(wv(2, key))}
      wk4={fmtPct(wv(3, key))}
      rem={fmtPct(wv(4, key))}
      metricType="Avg"
      monthly={fmtPct(m[mKey] as number | null)}
      highlight={highlight}
    />
  )

  const colHeader = (text: string, sub?: string) => (
    <th style={{
      padding: '8px 6px', textAlign: 'center', fontSize: 11, fontWeight: 600,
      color: '#fff', background: HEADER_BG, whiteSpace: 'nowrap',
      borderRight: '1px solid rgba(255,255,255,0.08)',
    }}>
      {text}{sub && <div style={{ fontSize: 10, fontWeight: 400, opacity: 0.7 }}>{sub}</div>}
    </th>
  )

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1100 }}>
        <thead>
          <tr>
            <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: 11,
              fontWeight: 700, color: '#fff', background: HEADER_BG,
              letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              Metrics
            </th>
            <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: 11,
              fontWeight: 600, color: '#fff', background: HEADER_BG,
              borderRight: '1px solid rgba(255,255,255,0.08)' }}>
              Definition
            </th>
            {/* Headers pulled from the backend so they follow the real calendar */}
            {[0, 1, 2, 3, 4].map(i => {
              const label = data.weeks[i]?.label ?? ''
              // label is like "Week 1 [2-6]" or "Remainder [1-3]"
              const m = label.match(/^(.+?)\s*(\[[^\]]*\])?$/)
              const title    = m?.[1] ?? label
              const subtitle = m?.[2] ?? ''
              return <React.Fragment key={i}>{colHeader(title, subtitle)}</React.Fragment>
            })}
            {colHeader('Metric Type')}
            {colHeader('Monthly Actual')}
            {colHeader('Monthly Goal')}
          </tr>
        </thead>
        <tbody>

          {/* ── FINANCES ── */}
          <SectionHeader label="Finances $$$" />
          {crow('Total Revenue',
            'Total revenue collected in last 7 days',
            'totalRevenue', 'totalRevenue', true)}
          {crow('Total Revenue from Product Sales',
            'Total product sales in the last 7 days',
            'productSalesRevenue', 'productSalesRevenue')}
          {crow('Upfront Revenue',
            'Total upfront revenue from upfront treatment plan',
            'upfrontRevenue', 'upfrontRevenue', true)}
          {crow('Cash Collected from Insurance Patients',
            'Cash collected from insurance patients last 7 days',
            'cashFromInsurance', 'cashFromInsurance')}
          <DataRow
            label="Projected Revenue from Insurance Patients"
            definition="Projected revenue from insurance claims etc last 7 days"
            wk1="" wk2="" wk3="" wk4="" rem=""
            metricType="" monthly="$0.00"
          />
          <DataRow
            label="Debt Collection"
            definition="Total revenue sent to debt collection (all time)"
            wk1="" wk2="" wk3="" wk4="" rem=""
            metricType="Total" monthly="$0.00"
          />

          {/* ── MARKETING ── */}
          <SectionHeader label="Marketing" />
          <DataRow
            label="New Opt Ins To The List"
            definition="Total number of new opt ins to our email list in last 7 days"
            wk1="" wk2="" wk3="" wk4="" rem=""
            metricType="Total" monthly="0"
          />
          {nrow('New Patients',
            'Total number of new patients in the last 7 days',
            'newPatients', 'newPatients', 'Total', true)}
          {nrow('Patient Reactivations (New Episodes)',
            'Total number of patient reactivations in the last 7 days',
            'patientReactivations', 'patientReactivations')}
          <DataRow
            label="Ad Spend"
            definition="Total ad spend across all campaigns for last 7 days"
            wk1="" wk2="" wk3="" wk4="" rem=""
            metricType="" monthly=""
          />
          <DataRow
            label="Cost Per Patient"
            definition="Total ad spend / number of new patients"
            wk1="" wk2="" wk3="" wk4="" rem=""
            metricType="Total" monthly="$0.00"
          />

          {/* ── SALES ── */}
          <SectionHeader label="Sales (Service & Product Delivery)" />
          {nrow('Total Number of Patients For The Week',
            'Total number of patients in the calendar for the last 7 days',
            'totalPatients', 'totalPatients', 'Total', true)}
          {nrow('Appointments Attended',
            'Total number of appointments attended in the last 7 days',
            'appointmentsAttended', 'appointmentsAttended')}
          {prow('Appointment Show Up Rate %',
            'Total appt attended / Total Number of appt Booked',
            'showUpRate', 'showUpRate', true)}
          {nrow('Appointments Cancelled with No Rebooking',
            'Total number of appointments cancelled & no re-booking in the last 7 days',
            'appointmentsCancelled', 'appointmentsCancelled')}
          {nrow('Appointments Cancelled & Rebooked',
            'Total number of appts cancelled & re-booked in the last 7 days',
            'appointmentsRebooked', 'appointmentsRebooked')}
          {prow('Cancellation %',
            'Number of appts cancelled / Total number of appts attended',
            'cancellationRate', 'cancellationRate')}
          {nrow('No Show Appointments',
            'Total number of no show appts in the last 7 days',
            'noShows', 'noShows')}
          {prow('Case Acceptance % For All Team',
            'Average case acceptance across the whole team in the last 7 days',
            'caseAcceptance', 'caseAcceptance', true)}
          {nrow('Number of Clients Who Took The Upfront Treatment Plan Option',
            'Number of clients who accepted upfront offer (payment collected) in the last 7 days',
            'upfrontPlanAccepted', 'upfrontPlanAccepted')}
          {nrow('Clients Who Accepted a Product or Upsell',
            'Number of clients who accepted a product or upsell in the last 7 days',
            'productsUpsold', 'productsUpsold')}
          <DataRow
            label="Clients Who Transitioned To A Complementary Service"
            definition="Number of clients who transitioned to a complementary service in last 7 days"
            wk1="" wk2="" wk3="" wk4="" rem=""
            metricType="Total" monthly="0"
          />
          <DataRow
            label="Active Patients"
            definition="Total number of active patients in treatment in the last 7 days"
            wk1="" wk2="" wk3="" wk4="" rem=""
            metricType="Avg" monthly="0"
          />
          <DataRow
            label="Inactive Patients"
            definition="Total number of inactive patients not in treatment (all time)"
            wk1="" wk2="" wk3="" wk4="" rem=""
            metricType="" monthly=""
          />

        </tbody>
      </table>
    </div>
  )
}

// ── Main Dashboard Page ───────────────────────────────────────
export default function DashboardPage() {
  const { logout, user }    = useAuthStore()
  const now                 = new Date()
  const [clinic, setClinic] = useState('newport')
  const [month, setMonth]   = useState(now.getMonth() + 1)
  const [year, setYear]     = useState(now.getFullYear())
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)
  const [data, setData]       = useState<DashboardData | null>(null)

  const fetchData = useCallback(async (forceRefresh = false) => {
    setLoading(true); setError(null)
    try {
      const result = await dashboardApi.getMonthly(clinic, month, year, { forceRefresh })
      setData(result)
    } catch (e: any) {
      setError(e.response?.data?.error || 'Failed to fetch data')
    } finally {
      setLoading(false)
    }
  }, [clinic, month, year])

  // Auto-fetch whenever the selection changes (including preset clicks).
  useEffect(() => { fetchData() }, [fetchData])

  const currentClinic = CLINIC_LIST.find(c => c.id === clinic)

  const years = [2025, 2026, 2027]

  // ── Quick date presets, Nookal-style ──────────────────────────
  const applyMonthOffset = (offset: number) => {
    const d = new Date(now.getFullYear(), now.getMonth() + offset, 1)
    setMonth(d.getMonth() + 1)
    setYear(d.getFullYear())
  }
  const presets = [
    { label: 'This Month',     offset:  0 },
    { label: 'Last Month',     offset: -1 },
    { label: '2 Months Ago',   offset: -2 },
    { label: '3 Months Ago',   offset: -3 },
  ]
  const activePresetOffset = (() => {
    for (const p of presets) {
      const d = new Date(now.getFullYear(), now.getMonth() + p.offset, 1)
      if (d.getMonth() + 1 === month && d.getFullYear() === year) return p.offset
    }
    return null
  })()

  return (
    <div style={{ minHeight: '100vh', background: '#f0f2f5', fontFamily: "'DM Sans', sans-serif" }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg) } }
        @keyframes fadeIn { from { opacity:0; transform:translateY(6px) } to { opacity:1; transform:none } }
        .clinic-btn:hover { background: #e8f5f0 !important; border-color: #0f6e56 !important; color: #0f6e56 !important }
        .clinic-btn.active { background: #0f6e56 !important; color: #fff !important; border-color: #0f6e56 !important }
        .fetch-btn:hover:not(:disabled) { background: #0a5040 !important }
        select:focus { outline: none; border-color: #0f6e56; box-shadow: 0 0 0 2px rgba(15,110,86,0.15) }
      `}</style>

      {/* ── Header ── */}
      <div style={{
        background: NAVY, color: '#fff',
        padding: '0 28px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        height: 56, boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{
            width: 34, height: 34, background: TEAL, borderRadius: 8,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{ color: '#fff', fontWeight: 700, fontSize: 13 }}>PW</span>
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, letterSpacing: '0.01em' }}>PhysioWard Sports & Rehab</div>
            <div style={{ fontSize: 10, opacity: 0.5, letterSpacing: '0.08em', textTransform: 'uppercase' }}>CEO Dashboard</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{ fontSize: 12, opacity: 0.5 }}>{user?.email}</span>
          <button
            onClick={logout}
            style={{
              background: 'transparent', border: '1px solid rgba(255,255,255,0.2)',
              color: '#fff', borderRadius: 6, padding: '5px 12px',
              fontSize: 12, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif",
            }}
          >
            Sign out
          </button>
        </div>
      </div>

      {/* ── Controls Bar ── */}
      <div style={{
        background: '#fff', borderBottom: '1px solid #e5e7eb',
        padding: '14px 28px',
        display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap',
      }}>

        {/* Clinic selector */}
        <div style={{ display: 'flex', gap: 6 }}>
          {CLINIC_LIST.map(c => (
            <button
              key={c.id}
              className={`clinic-btn${clinic === c.id ? ' active' : ''}`}
              onClick={() => setClinic(c.id)}
              style={{
                padding: '7px 16px', border: '1px solid #e5e7eb',
                borderRadius: 7, background: '#fff',
                cursor: 'pointer', fontSize: 13, fontWeight: 500,
                fontFamily: "'DM Sans', sans-serif",
                color: '#374151', transition: 'all 0.15s',
              }}
            >
              {c.name}
            </button>
          ))}
        </div>

        <div style={{ width: 1, height: 28, background: '#e5e7eb' }} />

        {/* Quick date presets — Nookal-style */}
        <div style={{ display: 'flex', gap: 6 }}>
          {presets.map(p => {
            const isActive = activePresetOffset === p.offset
            return (
              <button
                key={p.offset}
                onClick={() => applyMonthOffset(p.offset)}
                className={`clinic-btn${isActive ? ' active' : ''}`}
                style={{
                  padding: '7px 14px', border: '1px solid #e5e7eb',
                  borderRadius: 7, background: '#fff',
                  cursor: 'pointer', fontSize: 12, fontWeight: 500,
                  fontFamily: "'DM Sans', sans-serif",
                  color: '#374151', transition: 'all 0.15s',
                }}
              >
                {p.label}
              </button>
            )
          })}
        </div>

        <div style={{ width: 1, height: 28, background: '#e5e7eb' }} />

        {/* Month selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12, color: '#6b7280', fontWeight: 500 }}>Month</span>
          <select
            value={month}
            onChange={e => setMonth(Number(e.target.value))}
            style={{
              border: '1px solid #e5e7eb', borderRadius: 6, padding: '6px 10px',
              fontSize: 13, fontFamily: "'DM Sans', sans-serif",
              color: '#111827', background: '#fff', cursor: 'pointer',
              transition: 'border-color 0.15s',
            }}
          >
            {MONTHS.map((name, i) => (
              <option key={i + 1} value={i + 1}>{name}</option>
            ))}
          </select>

          <select
            value={year}
            onChange={e => setYear(Number(e.target.value))}
            style={{
              border: '1px solid #e5e7eb', borderRadius: 6, padding: '6px 10px',
              fontSize: 13, fontFamily: "'DM Sans', sans-serif",
              color: '#111827', background: '#fff', cursor: 'pointer',
            }}
          >
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>

        {/* Fetch button */}
        <button
          className="fetch-btn"
          onClick={() => fetchData(true)}
          disabled={loading}
          style={{
            background: loading ? '#9ca3af' : TEAL,
            color: '#fff', border: 'none', borderRadius: 7,
            padding: '8px 22px', fontSize: 13, fontWeight: 600,
            cursor: loading ? 'not-allowed' : 'pointer',
            fontFamily: "'DM Sans', sans-serif",
            transition: 'background 0.15s',
            display: 'flex', alignItems: 'center', gap: 8,
          }}
        >
          {loading ? (
            <>
              <span style={{
                width: 13, height: 13,
                border: '2px solid rgba(255,255,255,0.3)',
                borderTop: '2px solid #fff',
                borderRadius: '50%', display: 'inline-block',
                animation: 'spin 0.7s linear infinite',
              }} />
              Fetching Nookal...
            </>
          ) : '↻ Refresh'}
        </button>

        {/* Last fetched */}
        {data && (
          <span style={{ fontSize: 12, color: '#9ca3af' }}>
            {currentClinic?.name} · {MONTHS[data.month - 1]} {data.year} · fetched in {data.duration}ms
          </span>
        )}
      </div>

      {/* ── Error ── */}
      {error && (
        <div style={{
          margin: '20px 28px 0',
          background: '#fef2f2', border: '1px solid #fecaca',
          borderRadius: 8, padding: '12px 16px',
          fontSize: 13, color: '#991b1b',
          fontFamily: "'DM Sans', sans-serif",
        }}>
          ⚠️ {error}
        </div>
      )}

      {/* ── Table area ── */}
      <div style={{ padding: '20px 28px', animation: data ? 'fadeIn 0.3s ease' : 'none' }}>
        {loading ? (
          <FetchProgress active={loading} clinicName={currentClinic?.name} />
        ) : !data ? (
          <div style={{
            background: '#fff', borderRadius: 12,
            border: '1px solid #e5e7eb',
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            padding: '80px 0',
            color: '#9ca3af',
          }}>
            <div style={{ fontSize: 42, marginBottom: 16 }}>📊</div>
            <div style={{ fontSize: 16, fontWeight: 500, color: '#374151', marginBottom: 8 }}>
              Select a clinic and month, then click Fetch Data
            </div>
            <div style={{ fontSize: 13 }}>
              All 5 weeks will auto-populate from Nookal
            </div>
          </div>
        ) : (
          <div style={{
            background: '#fff', borderRadius: 12,
            border: '1px solid #e5e7eb', overflow: 'hidden',
            boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
          }}>
            {/* Dashboard title bar */}
            <div style={{
              background: HEADER_BG, color: '#fff',
              padding: '12px 20px',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <div style={{ fontWeight: 700, fontSize: 16, letterSpacing: '0.02em' }}>
                CEO Dashboard — {currentClinic?.name}
              </div>
              <div style={{ fontSize: 12, opacity: 0.6, fontFamily: "'DM Mono', monospace" }}>
                {MONTHS[data.month - 1]} {data.year}
              </div>
            </div>
            <DashboardTable data={data} />

            {/* Footer */}
            <div style={{
              padding: '8px 14px', background: '#f9fafb',
              borderTop: '1px solid #e5e7eb',
              fontSize: 11, color: '#9ca3af',
              fontFamily: "'DM Mono', monospace",
              display: 'flex', gap: 24,
            }}>
              {data.weeks.map(w => (
                <span key={w.weekNum}>
                  {w.label}: {w.appointmentsAttended} appts · ${w.totalRevenue.toFixed(0)} rev
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
