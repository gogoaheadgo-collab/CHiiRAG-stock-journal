import { useState, useEffect, useCallback } from 'react'
import Head from 'next/head'
import { supabase } from '../lib/supabase'
import AddTradeModal from '../components/AddTradeModal'
import CloseTradeModal from '../components/CloseTradeModal'
import EditTradeModal from '../components/EditTradeModal'
import { differenceInDays, format } from 'date-fns'

// ─── India Flag Round Logo ────────────────────────────────────────────────────
function IndiaFlagLogo({ size = 40 }) {
  const r = size / 2
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ borderRadius: '50%', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.15)', display: 'block' }}>
      <rect x="0" y="0" width={size} height={size / 3} fill="#FF9933" />
      <rect x="0" y={size / 3} width={size} height={size / 3} fill="#FFFFFF" />
      <rect x="0" y={size * 2 / 3} width={size} height={size / 3} fill="#138808" />
      <circle cx={r} cy={r} r={size * 0.14} fill="none" stroke="#000080" strokeWidth={size * 0.025} />
      {Array.from({ length: 24 }).map((_, i) => {
        const angle = (i * 15 * Math.PI) / 180
        const x1 = r + Math.cos(angle) * size * 0.03
        const y1 = r + Math.sin(angle) * size * 0.03
        const x2 = r + Math.cos(angle) * size * 0.13
        const y2 = r + Math.sin(angle) * size * 0.13
        return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#000080" strokeWidth={size * 0.015} />
      })}
      <circle cx={r} cy={r} r={size * 0.025} fill="#000080" />
      <circle cx={r} cy={r} r={r - 1} fill="none" stroke="#dde2ee" strokeWidth="2" />
    </svg>
  )
}

// ─── Auth Screen ──────────────────────────────────────────────────────────────
function AuthScreen() {
  const [loading, setLoading] = useState(false)
  const signIn = async () => {
    setLoading(true)
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: typeof window !== 'undefined' ? window.location.origin : '' },
    })
  }
  return (
    <div className="auth-bg">
      <div className="auth-grid" />
      <div className="auth-glow" />
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '5px', background: 'linear-gradient(90deg, #FF9933 33.33%, #f0f0f0 33.33%, #f0f0f0 66.66%, #138808 66.66%)', zIndex: 10 }} />
      <div style={{ position: 'relative', zIndex: 10, textAlign: 'center', maxWidth: '420px', padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px' }}>
          <div style={{ padding: '8px', background: 'white', borderRadius: '50%', boxShadow: '0 4px 20px rgba(14,165,233,0.2)' }}>
            <IndiaFlagLogo size={80} />
          </div>
        </div>
        <div style={{ fontSize: '10px', letterSpacing: '0.3em', textTransform: 'uppercase', color: 'var(--accent)', marginBottom: '8px', fontFamily: 'DM Mono, monospace' }}>
          NSE · BSE · MTF Tracking
        </div>
        <h1 className="font-display" style={{ fontSize: '40px', fontWeight: 700, color: 'var(--text)', lineHeight: 1.15, marginBottom: '8px' }}>
          Chiirag<br /><span style={{ color: 'var(--accent)' }}>Stock Journal</span>
        </h1>
        <div style={{ width: '120px', height: '3px', margin: '0 auto 20px', background: 'linear-gradient(90deg, #FF9933 33%, #e0e0e0 33%, #e0e0e0 66%, #138808 66%)', borderRadius: '2px' }} />
        <p style={{ color: 'var(--muted)', fontSize: '13px', lineHeight: 1.7, marginBottom: '32px', fontFamily: 'DM Mono, monospace' }}>
          Personal trade journal with live NSE/BSE prices,<br />MTF interest tracking &amp; full P&amp;L analytics.
        </p>
        <button onClick={signIn} disabled={loading} className="btn btn-primary" style={{ padding: '12px 32px', fontSize: '14px', width: '100%', justifyContent: 'center', borderRadius: '8px' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          {loading ? 'Signing in...' : 'Sign in with Google'}
        </button>
        <p style={{ marginTop: '14px', fontSize: '11px', color: 'var(--muted)', fontFamily: 'DM Mono, monospace' }}>Private &amp; Secure · Only your data, always</p>
      </div>
    </div>
  )
}

// ─── Stat Card ────────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, color }) {
  return (
    <div className="stat-card">
      <div className="stat-label">{label}</div>
      <div className="stat-value" style={{ color: color || 'var(--text)' }}>{value}</div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  )
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function Home() {
  const [session, setSession] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [trades, setTrades] = useState([])
  const [livePrices, setLivePrices] = useState({})
  const [fetchingPrice, setFetchingPrice] = useState({})
  const [filter, setFilter] = useState('ALL')
  const [accountFilter, setAccountFilter] = useState('ALL')
  const [showAdd, setShowAdd] = useState(false)
  const [closingTrade, setClosingTrade] = useState(null)
  const [editingTrade, setEditingTrade] = useState(null)
  const [tradesLoading, setTradesLoading] = useState(false)
  const [accounts, setAccounts] = useState([])
  const [lastRefresh, setLastRefresh] = useState(null)
  const [countdown, setCountdown] = useState(60)

  // Auth
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => { setSession(session); setAuthLoading(false) })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, s) => { setSession(s); setAuthLoading(false) })
    return () => subscription.unsubscribe()
  }, [])

  // Load trades
  const loadTrades = useCallback(async () => {
    if (!session) return
    setTradesLoading(true)
    const { data } = await supabase.from('trades').select('*').eq('user_id', session.user.id).order('created_at', { ascending: false })
    if (data) setTrades(data)
    setTradesLoading(false)
  }, [session])

  useEffect(() => { loadTrades() }, [loadTrades])

  useEffect(() => {
    const names = [...new Set(trades.map(t => t.account).filter(Boolean))]
    setAccounts(names)
  }, [trades])

  // Fetch single price
  const fetchPrice = useCallback(async (symbol) => {
    if (livePrices[symbol] !== undefined || fetchingPrice[symbol]) return
    setFetchingPrice(p => ({ ...p, [symbol]: true }))
    try {
      const res = await fetch(`/api/stock/${symbol}`)
      const data = await res.json()
      if (data.price) setLivePrices(p => ({ ...p, [symbol]: data }))
    } catch {}
    setFetchingPrice(p => ({ ...p, [symbol]: false }))
  }, [livePrices, fetchingPrice])

  // Refresh all prices
  const refreshAllPrices = useCallback(async () => {
    const openSymbols = [...new Set(trades.filter(t => t.status === 'OPEN').map(t => t.ticker))]
    if (openSymbols.length === 0) return
    setLivePrices({}); setFetchingPrice({})
    for (const symbol of openSymbols) {
      try {
        setFetchingPrice(p => ({ ...p, [symbol]: true }))
        const res = await fetch(`/api/stock/${symbol}`)
        const data = await res.json()
        if (data.price) setLivePrices(p => ({ ...p, [symbol]: data }))
        setFetchingPrice(p => ({ ...p, [symbol]: false }))
      } catch {}
    }
    setLastRefresh(new Date()); setCountdown(60)
  }, [trades])

  useEffect(() => {
    trades.filter(t => t.status === 'OPEN').forEach(t => fetchPrice(t.ticker))
  }, [trades]) // eslint-disable-line

  useEffect(() => {
    if (trades.filter(t => t.status === 'OPEN').length === 0) return
    const interval = setInterval(() => { refreshAllPrices() }, 60000)
    return () => clearInterval(interval)
  }, [trades, refreshAllPrices])

  useEffect(() => {
    if (trades.filter(t => t.status === 'OPEN').length === 0) return
    setCountdown(60)
    const timer = setInterval(() => setCountdown(c => c <= 1 ? 60 : c - 1), 1000)
    return () => clearInterval(timer)
  }, [lastRefresh, trades])

  // Handlers
  const handleAdd = async (data) => {
    const { error } = await supabase.from('trades').insert([{ ...data, user_id: session.user.id }])
    if (error) throw new Error(error.message)
    await loadTrades()
  }

  const handleClose = async (updates) => {
    const { error } = await supabase.from('trades').update(updates).eq('id', closingTrade.id)
    if (error) throw new Error(error.message)
    await loadTrades(); setClosingTrade(null)
  }

  const handleEdit = async (updates) => {
    const { error } = await supabase.from('trades').update(updates).eq('id', editingTrade.id)
    if (error) throw new Error(error.message)
    await loadTrades(); setEditingTrade(null)
  }

  const handleDelete = async (id) => {
    if (!confirm('Delete this trade permanently?')) return
    await supabase.from('trades').delete().eq('id', id)
    await loadTrades()
  }

  const signOut = () => supabase.auth.signOut()

  // Filtering
  const filtered = trades.filter(t => {
    const statusOk = filter === 'ALL' || t.status === filter
    const accountOk = accountFilter === 'ALL' || t.account === accountFilter
    return statusOk && accountOk
  })

  const openTrades = trades.filter(t => t.status === 'OPEN')
  const closedTrades = trades.filter(t => t.status === 'CLOSED')

  // Stats
  const totalRealised = closedTrades.reduce((s, t) => s + (t.realized_gains || 0), 0)
  const totalUnrealised = openTrades.reduce((s, t) => {
    const lp = livePrices[t.ticker]; if (!lp) return s
    return t.direction === 'LONG' ? s + (lp.price - t.entry_price) * t.quantity : s + (t.entry_price - lp.price) * t.quantity
  }, 0)
  const totalMTFInterest = trades.reduce((s, t) => {
    if (!t.mtf_value || !t.mtf_interest_rate) return s
    const days = Math.max(0, differenceInDays(t.exit_date ? new Date(t.exit_date) : new Date(), new Date(t.entry_date)))
    return s + (t.mtf_value * t.mtf_interest_rate * days) / 36500
  }, 0)
  const wins = closedTrades.filter(t => (t.realized_gains || 0) > 0)
  const winRate = closedTrades.length > 0 ? (wins.length / closedTrades.length) * 100 : null
  const totalInvested = openTrades.reduce((s, t) => s + (t.invested_capital || 0), 0)
  const netPnL = totalRealised + totalUnrealised

  if (authLoading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'white' }}>
      <div style={{ color: 'var(--muted)', letterSpacing: '0.15em', fontSize: '11px', fontFamily: 'DM Mono, monospace' }}>LOADING...</div>
    </div>
  )

  if (!session) return <AuthScreen />

  return (
    <>
      <Head>
        <title>Chiirag Stock Journal</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#ffffff" />
      </Head>

      {/* Tricolor top bar */}
      <div style={{ height: '4px', background: 'linear-gradient(90deg, #FF9933 33.33%, #e8e8e8 33.33%, #e8e8e8 66.66%, #138808 66.66%)', position: 'fixed', top: 0, left: 0, right: 0, zIndex: 50 }} />

      {/* Header */}
      <header className="header" style={{ marginTop: '4px' }}>
        <div className="header-logo">
          <IndiaFlagLogo size={36} />
          <span className="font-display header-title" style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text)' }}>
            Chiirag <span style={{ color: 'var(--accent)' }}>Stock Journal</span>
          </span>
          <span style={{ color: 'var(--muted)', fontSize: '11px', marginLeft: '4px', display: 'flex', alignItems: 'center', gap: '4px', fontFamily: 'DM Mono, monospace' }}>
            <span className="live-dot" />
            <span className="hide-mobile">{openTrades.length > 0 ? `LIVE · ${countdown}s` : 'LIVE NSE'}</span>
          </span>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {openTrades.length > 0 && (
            <button onClick={refreshAllPrices} className="btn btn-ghost" style={{ padding: '6px 12px', fontSize: '11px' }}>↻ Refresh</button>
          )}
          <button onClick={() => setShowAdd(true)} className="btn btn-primary" style={{ padding: '7px 16px' }}>
            <span style={{ fontSize: '16px', lineHeight: 1 }}>+</span>
            <span className="hide-mobile">New Trade</span>
          </button>
          <button onClick={signOut} className="btn btn-ghost" style={{ padding: '7px 12px' }}>
            <span className="hide-mobile">Sign Out</span>
          </button>
        </div>
      </header>

      <main style={{ maxWidth: '1600px', margin: '0 auto', padding: '18px 14px' }}>

        {/* Stat Cards */}
        <div className="stat-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '10px', marginBottom: '18px' }}>
          <StatCard label="Open Positions" value={openTrades.length} sub={`${closedTrades.length} closed`} color="var(--accent)" />
          <StatCard label="Invested Capital" value={`₹${(totalInvested / 1000).toFixed(1)}K`} sub="Open positions" />
          <StatCard label="Unrealised P&L" value={`${totalUnrealised >= 0 ? '+' : ''}₹${Math.abs(totalUnrealised / 1000).toFixed(1)}K`} sub="Live prices" color={totalUnrealised >= 0 ? '#16a34a' : '#dc2626'} />
          <StatCard label="Realised P&L" value={`${totalRealised >= 0 ? '+' : ''}₹${Math.abs(totalRealised / 1000).toFixed(1)}K`} sub={`${closedTrades.length} trades`} color={totalRealised >= 0 ? '#16a34a' : '#dc2626'} />
          <StatCard label="Net P&L" value={`${netPnL >= 0 ? '+' : ''}₹${Math.abs(netPnL / 1000).toFixed(1)}K`} sub="Realised + Unrealised" color={netPnL >= 0 ? '#16a34a' : '#dc2626'} />
          <StatCard label="Win Rate" value={winRate !== null ? `${winRate.toFixed(0)}%` : '—'} sub={`${wins.length}W · ${closedTrades.length - wins.length}L`} color={winRate >= 50 ? '#16a34a' : winRate !== null ? '#dc2626' : undefined} />
          <StatCard label="MTF Interest" value={`₹${(totalMTFInterest / 1000).toFixed(1)}K`} sub="Accrued total" color="var(--gold)" />
        </div>

        {lastRefresh && (
          <div style={{ fontSize: '10px', color: 'var(--muted)', marginBottom: '8px', textAlign: 'right', fontFamily: 'DM Mono, monospace' }}>
            Last refreshed: {format(lastRefresh, 'hh:mm:ss a')} · Next in {countdown}s
          </div>
        )}

        {/* Filters */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: '4px' }}>
            {['ALL', 'OPEN', 'CLOSED'].map(f => (
              <button key={f} onClick={() => setFilter(f)} className={`tab ${filter === f ? 'active' : ''}`}>
                {f} ({f === 'ALL' ? trades.length : f === 'OPEN' ? openTrades.length : closedTrades.length})
              </button>
            ))}
          </div>
          {accounts.length > 0 && (
            <>
              <span style={{ color: 'var(--border2)' }}>|</span>
              <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                <button onClick={() => setAccountFilter('ALL')} className={`tab ${accountFilter === 'ALL' ? 'active' : ''}`}>All</button>
                {accounts.map(a => (
                  <button key={a} onClick={() => setAccountFilter(a)} className={`tab ${accountFilter === a ? 'active' : ''}`}>{a}</button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Table */}
        <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: '8px', overflow: 'auto', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          {tradesLoading ? (
            <div style={{ padding: '60px', textAlign: 'center', color: 'var(--muted)', fontFamily: 'DM Mono, monospace' }}>Loading trades...</div>
          ) : filtered.length === 0 ? (
            <div className="empty-state">
              <IndiaFlagLogo size={60} />
              <div className="empty-title" style={{ marginTop: '16px' }}>No Trades Yet</div>
              <div style={{ color: 'var(--muted)', fontSize: '13px', marginBottom: '20px' }}>Click "New Trade" to log your first position</div>
              <button onClick={() => setShowAdd(true)} className="btn btn-primary">+ Add First Trade</button>
            </div>
          ) : (
            <table className="trade-table">
              <thead>
                <tr>
                  <th>Account</th>
                  <th>Ticker</th>
                  <th>Status</th>
                  <th>Dir</th>
                  <th>Entry Date</th>
                  <th className="right">Entry ₹</th>
                  <th className="right">CMP ₹</th>
                  <th className="right hide-mobile">Exit ₹</th>
                  <th className="right">Qty</th>
                  <th className="right hide-mobile">Invested ₹</th>
                  <th className="right hide-mobile">Actual Inv ₹</th>
                  <th className="right hide-mobile">Pos %</th>
                  <th className="right">Unrealised</th>
                  <th className="right">Realised</th>
                  <th className="hide-mobile">Days</th>
                  <th className="right hide-mobile">MTF ₹</th>
                  <th className="right hide-mobile">MTF Int ₹</th>
                  <th className="hide-mobile">Exit Date</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(trade => {
                  const lp = livePrices[trade.ticker]
                  const isOpen = trade.status === 'OPEN'
                  const isLong = trade.direction === 'LONG'

                  const unrealised = isOpen && lp
                    ? isLong ? (lp.price - trade.entry_price) * trade.quantity
                             : (trade.entry_price - lp.price) * trade.quantity
                    : null

                  const unrealisedPct = unrealised !== null && trade.invested_capital > 0
                    ? (unrealised / trade.invested_capital) * 100 : null

                  const days = Math.max(0, differenceInDays(
                    trade.exit_date ? new Date(trade.exit_date) : new Date(), new Date(trade.entry_date)
                  ))

                  const mtfInterest = trade.mtf_value && trade.mtf_interest_rate
                    ? (trade.mtf_value * trade.mtf_interest_rate * days) / 36500 : null

                  const posSize = totalInvested > 0 && trade.invested_capital && isOpen
                    ? (trade.invested_capital / totalInvested) * 100 : null

                  return (
                    <tr key={trade.id}>
                      <td>
                        <span style={{ fontSize: '11px', color: 'var(--accent)', background: '#e0f2fe', padding: '2px 8px', borderRadius: '4px', border: '1px solid #bae6fd', fontFamily: 'DM Mono, monospace' }}>
                          {trade.account || '—'}
                        </span>
                      </td>
                      <td>
                        <div className="ticker-symbol">{trade.ticker}</div>
                        <div className="ticker-sub">NSE</div>
                      </td>
                      <td><span className={`badge badge-${trade.status.toLowerCase()}`}>{trade.status}</span></td>
                      <td><span className={`badge badge-${trade.direction.toLowerCase()}`}>{trade.direction === 'LONG' ? '▲' : '▼'} {trade.direction}</span></td>
                      <td style={{ color: 'var(--muted)', fontSize: '12px', fontFamily: 'DM Mono, monospace' }}>
                        {trade.entry_date ? format(new Date(trade.entry_date), 'dd MMM yy') : '—'}
                      </td>
                      <td className="right" style={{ fontFamily: 'Noto Sans, sans-serif' }}>₹{trade.entry_price?.toLocaleString('en-IN')}</td>
                      <td className="right">
                        {isOpen ? (
                          fetchingPrice[trade.ticker] ? (
                            <span style={{ color: 'var(--muted)', fontSize: '11px' }}>...</span>
                          ) : lp ? (
                            <div>
                              <div className={`cmp-price ${lp.change >= 0 ? 'profit' : 'loss'}`}>₹{lp.price?.toLocaleString('en-IN')}</div>
                              <div className={`cmp-change ${lp.change >= 0 ? 'profit' : 'loss'}`}>{lp.change >= 0 ? '+' : ''}{lp.changePercent?.toFixed(2)}%</div>
                            </div>
                          ) : <span className="neutral">—</span>
                        ) : <span className="neutral">—</span>}
                      </td>
                      <td className="right hide-mobile" style={{ fontFamily: 'Noto Sans, sans-serif' }}>
                        {trade.exit_price ? `₹${trade.exit_price.toLocaleString('en-IN')}` : <span className="neutral">—</span>}
                      </td>
                      <td className="right" style={{ fontFamily: 'Noto Sans, sans-serif' }}>{trade.quantity?.toLocaleString('en-IN')}</td>
                      <td className="right hide-mobile" style={{ fontFamily: 'Noto Sans, sans-serif' }}>
                        {trade.invested_capital ? `₹${trade.invested_capital.toLocaleString('en-IN', { maximumFractionDigits: 0 })}` : <span className="neutral">—</span>}
                      </td>
                      <td className="right hide-mobile" style={{ fontFamily: 'Noto Sans, sans-serif' }}>
                        {trade.actual_investment ? `₹${trade.actual_investment.toLocaleString('en-IN', { maximumFractionDigits: 0 })}` : <span className="neutral">—</span>}
                      </td>
                      <td className="right hide-mobile">
                        {posSize !== null ? <span className="neutral" style={{ fontFamily: 'DM Mono, monospace' }}>{posSize.toFixed(1)}%</span> : <span className="neutral">—</span>}
                      </td>
                      <td className="right">
                        {unrealised !== null ? (
                          <div>
                            <div className={unrealised >= 0 ? 'profit' : 'loss'} style={{ fontWeight: 700, fontFamily: 'Noto Sans, sans-serif' }}>
                              {unrealised >= 0 ? '+' : '−'}₹{Math.abs(unrealised).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                            </div>
                            <div className={unrealisedPct >= 0 ? 'profit' : 'loss'} style={{ fontSize: '10px', opacity: 0.8, fontFamily: 'Noto Sans, sans-serif' }}>
                              {unrealisedPct >= 0 ? '+' : ''}{unrealisedPct?.toFixed(2)}%
                            </div>
                          </div>
                        ) : <span className="neutral">—</span>}
                      </td>
                      <td className="right">
                        {trade.realized_gains != null ? (
                          <span className={trade.realized_gains >= 0 ? 'profit' : 'loss'} style={{ fontWeight: 700, fontFamily: 'Noto Sans, sans-serif' }}>
                            {trade.realized_gains >= 0 ? '+' : '−'}₹{Math.abs(trade.realized_gains).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                          </span>
                        ) : <span className="neutral">—</span>}
                      </td>
                      <td className="hide-mobile" style={{ color: 'var(--muted)', fontSize: '12px', fontFamily: 'DM Mono, monospace' }}>{days}d</td>
                      <td className="right hide-mobile" style={{ fontFamily: 'Noto Sans, sans-serif' }}>
                        {trade.mtf_value ? <span style={{ color: 'var(--gold)' }}>₹{trade.mtf_value.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span> : <span className="neutral">—</span>}
                      </td>
                      <td className="right hide-mobile">
                        {mtfInterest != null ? (
                          <div>
                            <div style={{ color: 'var(--gold)', fontWeight: 700, fontFamily: 'Noto Sans, sans-serif' }}>₹{mtfInterest.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</div>
                            <div style={{ fontSize: '9px', color: 'var(--muted)', fontFamily: 'DM Mono, monospace' }}>{trade.mtf_interest_rate}% p.a.</div>
                          </div>
                        ) : <span className="neutral">—</span>}
                      </td>
                      <td className="hide-mobile" style={{ color: 'var(--muted)', fontSize: '12px', fontFamily: 'DM Mono, monospace' }}>
                        {trade.exit_date ? format(new Date(trade.exit_date), 'dd MMM yy') : '—'}
                      </td>
                      {/* Actions */}
                      <td>
                        <div style={{ display: 'flex', gap: '4px' }}>
                          {/* Edit button - for ALL trades */}
                          <button onClick={() => setEditingTrade(trade)} className="icon-btn" title="Edit trade" style={{ fontSize: '12px' }}>✎</button>
                          {/* Close button - only for OPEN trades */}
                          {isOpen && (
                            <button onClick={() => setClosingTrade(trade)} className="icon-btn exit" title="Close trade">✓</button>
                          )}
                          {/* Delete button */}
                          <button onClick={() => handleDelete(trade.id)} className="icon-btn del" title="Delete trade">×</button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

        <div style={{ marginTop: '12px', textAlign: 'center', color: 'var(--muted)', fontSize: '11px', fontFamily: 'DM Mono, monospace' }}>
          Prices via Yahoo Finance · ~15 min delay · Not financial advice
        </div>
      </main>

      {showAdd && <AddTradeModal onClose={() => setShowAdd(false)} onAdd={handleAdd} />}
      {closingTrade && <CloseTradeModal trade={closingTrade} onClose={() => setClosingTrade(null)} onConfirm={handleClose} />}
      {editingTrade && <EditTradeModal trade={editingTrade} onClose={() => setEditingTrade(null)} onSave={handleEdit} />}
    </>
  )
}
