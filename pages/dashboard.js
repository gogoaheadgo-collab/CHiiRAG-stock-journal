import { useState, useEffect, useCallback } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'
import { supabase } from '../lib/supabase'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, subMonths, addMonths } from 'date-fns'

// ─── Nav Component ─────────────────────────────────────────────────────────────
function NavPill({ active }) {
  const router = useRouter()
  return (
    <div style={{
      display: 'flex', background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: '8px', padding: '3px', gap: '2px',
    }}>
      {[
        { label: 'Dashboard', path: '/dashboard' },
        { label: 'Accounts', path: '/accounts' },
      ].map(({ label, path }) => (
        <button key={path} onClick={() => router.push(path)} style={{
          padding: '5px 18px', borderRadius: '5px', border: 'none', cursor: 'pointer',
          fontSize: '11px', fontFamily: 'IBM Plex Mono, monospace', fontWeight: 600,
          letterSpacing: '0.05em',
          background: active === label ? 'var(--accent)' : 'transparent',
          color: active === label ? '#07080a' : 'var(--muted)',
          transition: 'all 0.15s',
        }}>
          {label}
        </button>
      ))}
    </div>
  )
}

// ─── Stat Card ─────────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, color }) {
  return (
    <div className="stat-card">
      <div style={{ fontSize: '10px', color: 'var(--muted)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '8px' }}>{label}</div>
      <div style={{ fontSize: '24px', fontWeight: 700, fontFamily: 'Syne, sans-serif', color: color || 'var(--text)' }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: '10px', color: 'var(--muted)', marginTop: '4px' }}>{sub}</div>}
    </div>
  )
}

// ─── P&L Calendar ──────────────────────────────────────────────────────────────
function PnLCalendar({ trades }) {
  const [month, setMonth] = useState(new Date())

  const days = eachDayOfInterval({ start: startOfMonth(month), end: endOfMonth(month) })
  const startDow = startOfMonth(month).getDay()

  // Build daily P&L map from closed trades
  const dailyPnL = {}
  trades.filter(t => t.status === 'CLOSED' && t.exit_date && t.realized_gains != null).forEach(t => {
    const key = t.exit_date.slice(0, 10)
    dailyPnL[key] = (dailyPnL[key] || 0) + t.realized_gains
  })

  const toIndian = (n) => {
    const abs = Math.abs(n)
    if (abs >= 10000000) return (n / 10000000).toFixed(1) + 'Cr'
    if (abs >= 100000) return (n / 100000).toFixed(1) + 'L'
    if (abs >= 1000) return (n / 1000).toFixed(1) + 'K'
    return n.toFixed(0)
  }

  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px', padding: '20px' }}>
      {/* Month nav */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <button onClick={() => setMonth(m => subMonths(m, 1))} style={{ background: 'none', border: '1px solid var(--border)', color: 'var(--muted)', borderRadius: '4px', padding: '4px 10px', cursor: 'pointer', fontSize: '14px' }}>‹</button>
        <span style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: '15px', color: 'var(--text)' }}>
          {format(month, 'MMMM yyyy')}
        </span>
        <button onClick={() => setMonth(m => addMonths(m, 1))} style={{ background: 'none', border: '1px solid var(--border)', color: 'var(--muted)', borderRadius: '4px', padding: '4px 10px', cursor: 'pointer', fontSize: '14px' }}>›</button>
      </div>

      {/* Day headers */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '3px', marginBottom: '3px' }}>
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
          <div key={d} style={{ textAlign: 'center', fontSize: '9px', color: 'var(--muted)', letterSpacing: '0.08em', padding: '4px 0' }}>{d}</div>
        ))}
      </div>

      {/* Calendar grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '3px' }}>
        {/* Empty cells for start offset */}
        {Array.from({ length: startDow }).map((_, i) => (
          <div key={`empty-${i}`} />
        ))}

        {days.map(day => {
          const key = format(day, 'yyyy-MM-dd')
          const pnl = dailyPnL[key]
          const isToday = isSameDay(day, new Date())
          const hasTrade = pnl !== undefined

          return (
            <div key={key} style={{
              borderRadius: '4px', padding: '6px 4px', textAlign: 'center', minHeight: '48px',
              background: hasTrade
                ? pnl >= 0 ? 'rgba(0,230,118,0.12)' : 'rgba(255,71,87,0.12)'
                : 'transparent',
              border: isToday
                ? '1px solid var(--accent)'
                : hasTrade
                  ? pnl >= 0 ? '1px solid rgba(0,230,118,0.3)' : '1px solid rgba(255,71,87,0.3)'
                  : '1px solid transparent',
              transition: 'all 0.1s',
            }}>
              <div style={{ fontSize: '10px', color: isToday ? 'var(--accent)' : 'var(--muted)', fontWeight: isToday ? 700 : 400 }}>
                {format(day, 'd')}
              </div>
              {hasTrade && (
                <div style={{
                  fontSize: '9px', fontWeight: 700, marginTop: '2px',
                  color: pnl >= 0 ? 'var(--green)' : 'var(--red)',
                  fontFamily: 'IBM Plex Mono, monospace',
                }}>
                  {pnl >= 0 ? '+' : '−'}₹{toIndian(Math.abs(pnl))}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: '16px', marginTop: '12px', justifyContent: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <div style={{ width: '10px', height: '10px', borderRadius: '2px', background: 'rgba(0,230,118,0.3)', border: '1px solid rgba(0,230,118,0.5)' }} />
          <span style={{ fontSize: '9px', color: 'var(--muted)' }}>Profit day</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <div style={{ width: '10px', height: '10px', borderRadius: '2px', background: 'rgba(255,71,87,0.3)', border: '1px solid rgba(255,71,87,0.5)' }} />
          <span style={{ fontSize: '9px', color: 'var(--muted)' }}>Loss day</span>
        </div>
      </div>
    </div>
  )
}

// ─── Main Dashboard ─────────────────────────────────────────────────────────────
export default function Dashboard() {
  const router = useRouter()
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [trades, setTrades] = useState([])

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (!session) router.push('/')
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, s) => {
      setSession(s)
      if (!s) router.push('/')
    })
    return () => subscription.unsubscribe()
  }, [])

  const loadTrades = useCallback(async () => {
    if (!session) return
    setLoading(true)
    const token = (await supabase.auth.getSession()).data.session?.access_token
    const res = await fetch('/api/trades', { headers: { Authorization: `Bearer ${token}` } })
    const data = await res.json()
    if (Array.isArray(data)) setTrades(data)
    setLoading(false)
  }, [session])

  useEffect(() => { if (session) loadTrades() }, [session, loadTrades])

  const signOut = () => supabase.auth.signOut().then(() => router.push('/'))

  // ── Calculations ──
  const toIndian = (n) => Number(n).toLocaleString('en-IN', { maximumFractionDigits: 0 })
  const toIndianDec = (n) => Number(n).toLocaleString('en-IN', { maximumFractionDigits: 2 })

  const closedTrades = trades.filter(t => t.status === 'CLOSED')
  const openTrades = trades.filter(t => t.status === 'OPEN')

  const totalRealised = closedTrades.reduce((s, t) => s + (t.realized_gains || 0), 0)
  const totalUnrealised = openTrades.reduce((s, t) => {
    if (!t.current_price || !t.entry_price || !t.quantity) return s
    const unr = t.direction === 'LONG'
      ? (t.current_price - t.entry_price) * t.quantity
      : (t.entry_price - t.current_price) * t.quantity
    return s + unr
  }, 0)

  const profitTrades = closedTrades.filter(t => (t.realized_gains || 0) > 0)
  const lossTrades = closedTrades.filter(t => (t.realized_gains || 0) < 0)
  const winRate = closedTrades.length > 0 ? (profitTrades.length / closedTrades.length * 100).toFixed(1) : '0.0'

  const totalMTF = openTrades.reduce((s, t) => {
    if (!t.mtf_value || !t.mtf_interest_rate || !t.entry_date) return s
    const days = Math.max(1, Math.floor((Date.now() - new Date(t.entry_date)) / 86400000))
    return s + (t.mtf_value * t.mtf_interest_rate * days) / 36500
  }, 0)

  if (!session) return null

  return (
    <>
      <Head><title>Dashboard — Chiirag Stock Journal</title></Head>

      {/* Header */}
      <header className="header">
        <NavPill active="Dashboard" />
        <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: '15px', color: 'var(--text)', letterSpacing: '-0.02em' }}>
          Chiirag <span style={{ color: 'var(--accent)' }}>Journal</span>
        </div>
        <button onClick={signOut} className="btn btn-ghost" style={{ padding: '5px 12px', fontSize: '11px' }}>Sign Out</button>
      </header>

      <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '24px 16px' }}>

        <div style={{ marginBottom: '24px' }}>
          <h1 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: '22px', color: 'var(--text)', marginBottom: '4px' }}>
            Overview
          </h1>
          <div style={{ fontSize: '11px', color: 'var(--muted)' }}>All accounts · All time</div>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px', color: 'var(--muted)' }}>Loading...</div>
        ) : (
          <>
            {/* Stat Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginBottom: '24px' }}>
              <StatCard
                label="Total Realised P&L"
                value={`${totalRealised >= 0 ? '+' : '−'}₹${toIndian(Math.abs(totalRealised))}`}
                color={totalRealised >= 0 ? 'var(--green)' : 'var(--red)'}
                sub="All closed trades"
              />
              <StatCard
                label="Unrealised P&L"
                value={`${totalUnrealised >= 0 ? '+' : '−'}₹${toIndian(Math.abs(totalUnrealised))}`}
                color={totalUnrealised >= 0 ? 'var(--green)' : 'var(--red)'}
                sub={`${openTrades.length} open positions`}
              />
              <StatCard
                label="Win Rate"
                value={`${winRate}%`}
                color="var(--accent)"
                sub={`${profitTrades.length} wins · ${lossTrades.length} losses`}
              />
              <StatCard
                label="Total Trades"
                value={trades.length}
                sub={`${openTrades.length} open · ${closedTrades.length} closed`}
              />
              <StatCard
                label="MTF Interest Due"
                value={`₹${toIndianDec(totalMTF)}`}
                color="var(--gold)"
                sub="Accrued on open positions"
              />
              <StatCard
                label="Profit Trades"
                value={profitTrades.length}
                color="var(--green)"
                sub={`Avg ₹${closedTrades.length > 0 ? toIndian(totalRealised / closedTrades.length) : 0} per trade`}
              />
            </div>

            {/* Calendar + Recent */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '16px' }}>
              {/* Calendar */}
              <PnLCalendar trades={trades} />

              {/* Recent closed trades */}
              <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px', padding: '20px' }}>
                <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: '13px', color: 'var(--text)', marginBottom: '14px' }}>
                  Recent Exits
                </div>
                {closedTrades.length === 0 ? (
                  <div style={{ color: 'var(--muted)', fontSize: '11px', textAlign: 'center', padding: '20px 0' }}>No closed trades yet</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {closedTrades.slice(-8).reverse().map(t => (
                      <div key={t.id} style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        padding: '8px 10px', borderRadius: '5px',
                        background: (t.realized_gains || 0) >= 0 ? 'rgba(0,230,118,0.06)' : 'rgba(255,71,87,0.06)',
                        border: `1px solid ${(t.realized_gains || 0) >= 0 ? 'rgba(0,230,118,0.15)' : 'rgba(255,71,87,0.15)'}`,
                      }}>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: '12px', color: 'var(--text)' }}>{t.ticker}</div>
                          <div style={{ fontSize: '10px', color: 'var(--muted)' }}>{t.account} · {t.exit_date?.slice(0, 10)}</div>
                        </div>
                        <div style={{
                          fontSize: '12px', fontWeight: 700, fontFamily: 'IBM Plex Mono, monospace',
                          color: (t.realized_gains || 0) >= 0 ? 'var(--green)' : 'var(--red)',
                        }}>
                          {(t.realized_gains || 0) >= 0 ? '+' : '−'}₹{toIndian(Math.abs(t.realized_gains || 0))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </main>
    </>
  )
}


