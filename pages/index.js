import { useState, useEffect, useCallback } from 'react'
import Head from 'next/head'
import { supabase } from '../lib/supabase'
import AddTradeModal from '../components/AddTradeModal'
import CloseTradeModal from '../components/CloseTradeModal'
import { differenceInDays, format } from 'date-fns'

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
    <div className="auth-bg" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="auth-grid" />
      <div className="auth-glow" />

      <div style={{ position: 'relative', zIndex: 10, textAlign: 'center', maxWidth: '420px', padding: '24px' }}>
        {/* Logo mark */}
        <div style={{ marginBottom: '28px', display: 'flex', justifyContent: 'center' }}>
          <div style={{
            width: '56px', height: '56px', borderRadius: '12px',
            background: 'linear-gradient(135deg, var(--accent), var(--accent2))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 40px rgba(0,212,255,0.3)',
          }}>
            <span style={{ fontSize: '24px', fontFamily: 'Syne, sans-serif', fontWeight: 800, color: '#07080a' }}>C</span>
          </div>
        </div>

        <div style={{ fontSize: '10px', letterSpacing: '0.25em', textTransform: 'uppercase', color: 'var(--accent)', marginBottom: '10px' }}>
          NSE · BSE · MTF Tracking
        </div>
        <h1 className="font-syne" style={{ fontSize: '36px', fontWeight: 800, color: 'var(--text)', lineHeight: 1.15, marginBottom: '10px' }}>
          Chiirag<br />
          <span style={{ color: 'var(--accent)' }}>Stock Journal</span>
        </h1>
        <p style={{ color: 'var(--muted)', fontSize: '12px', lineHeight: 1.7, marginBottom: '32px' }}>
          Personal trade journal with live NSE/BSE prices,<br />
          MTF interest tracking, and full P&amp;L analytics.
        </p>

        <button
          onClick={signIn}
          disabled={loading}
          className="btn btn-primary"
          style={{ padding: '12px 32px', fontSize: '13px', width: '100%', justifyContent: 'center' }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          {loading ? 'Signing in...' : 'Sign in with Google'}
        </button>

        <p style={{ marginTop: '16px', fontSize: '10px', color: 'var(--muted)' }}>
          gogoaheadgo@gmail.com · Private &amp; Secure
        </p>
      </div>
    </div>
  )
}

// ─── Stat Card ────────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, color, accent }) {
  return (
    <div className="stat-card" style={accent ? { borderColor: `rgba(0,212,255,0.2)` } : {}}>
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
  const [tradesLoading, setTradesLoading] = useState(false)
  const [accounts, setAccounts] = useState([])

  // Auth
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session); setAuthLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, s) => {
      setSession(s); setAuthLoading(false)
    })
    return () => subscription.unsubscribe()
  }, [])

  // Load trades
  const loadTrades = useCallback(async () => {
    if (!session) return
    setTradesLoading(true)
    const { data } = await supabase
      .from('trades')
      .select('*')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false })
    if (data) setTrades(data)
    setTradesLoading(false)
  }, [session])

  useEffect(() => { loadTrades() }, [loadTrades])

  // Load unique account names for filter bar
  useEffect(() => {
    const names = [...new Set(trades.map(t => t.account).filter(Boolean))]
    setAccounts(names)
  }, [trades])

  // Fetch live price (once per symbol)
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

  useEffect(() => {
    trades.filter(t => t.status === 'OPEN').forEach(t => fetchPrice(t.ticker))
  }, [trades]) // eslint-disable-line

  // Add trade
  const handleAdd = async (data) => {
    const { error } = await supabase.from('trades').insert([{ ...data, user_id: session.user.id }])
    if (error) throw new Error(error.message)
    await loadTrades()
  }

  // Close trade
  const handleClose = async (updates) => {
    const { error } = await supabase.from('trades').update(updates).eq('id', closingTrade.id)
    if (error) throw new Error(error.message)
    await loadTrades()
    setClosingTrade(null)
  }

  // Delete
  const handleDelete = async (id) => {
    if (!confirm('Delete this trade permanently?')) return
    await supabase.from('trades').delete().eq('id', id)
    await loadTrades()
  }

  const signOut = () => supabase.auth.signOut()

  // ── Filtering ──────────────────────────────────────────────────────────────
  const filtered = trades.filter(t => {
    const statusOk = filter === 'ALL' || t.status === filter
    const accountOk = accountFilter === 'ALL' || t.account === accountFilter
    return statusOk && accountOk
  })

  const openTrades = trades.filter(t => t.status === 'OPEN')
  const closedTrades = trades.filter(t => t.status === 'CLOSED')

  // ── Stats ──────────────────────────────────────────────────────────────────
  const totalRealised = closedTrades.reduce((s, t) => s + (t.realized_gains || 0), 0)

  const totalUnrealised = openTrades.reduce((s, t) => {
    const lp = livePrices[t.ticker]
    if (!lp) return s
    const pnl = t.direction === 'LONG'
      ? (lp.price - t.entry_price) * t.quantity
      : (t.entry_price - lp.price) * t.quantity
    return s + pnl
  }, 0)

  const totalMTFInterest = trades.reduce((s, t) => {
    if (!t.mtf_value || !t.mtf_interest_rate) return s
    const startDate = new Date(t.entry_date)
    const endDate = t.exit_date ? new Date(t.exit_date) : new Date()
    const days = Math.max(0, differenceInDays(endDate, startDate))
    return s + (t.mtf_value * t.mtf_interest_rate * days) / 36500
  }, 0)

  const wins = closedTrades.filter(t => (t.realized_gains || 0) > 0)
  const winRate = closedTrades.length > 0 ? (wins.length / closedTrades.length) * 100 : null

  const totalInvested = openTrades.reduce((s, t) => s + (t.invested_capital || 0), 0)

  if (authLoading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
      <div style={{ color: 'var(--muted)', letterSpacing: '0.15em', fontSize: '11px' }}>LOADING...</div>
    </div>
  )

  if (!session) return <AuthScreen />

  return (
    <>
      <Head>
        <title>Chiirag Stock Journal</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="description" content="Personal NSE/BSE trade journal" />
      </Head>

      {/* ── Header ── */}
      <header className="header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '30px', height: '30px', borderRadius: '6px',
            background: 'linear-gradient(135deg, var(--accent), var(--accent2))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span className="font-syne" style={{ fontSize: '14px', fontWeight: 800, color: '#07080a' }}>C</span>
          </div>
          <span className="font-syne" style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text)', letterSpacing: '0.02em' }}>
            Chiirag Stock Journal
          </span>
          <span style={{ color: 'var(--border2)', fontSize: '14px' }}>|</span>
          <span style={{ color: 'var(--muted)', fontSize: '10px', letterSpacing: '0.06em' }}>
            <span className="live-dot" />LIVE NSE/BSE
          </span>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button onClick={() => setShowAdd(true)} className="btn btn-primary" style={{ padding: '6px 16px' }}>
            <span style={{ fontSize: '14px' }}>+</span> New Trade
          </button>
          <button onClick={signOut} className="btn btn-ghost" style={{ padding: '6px 12px' }}>Sign Out</button>
        </div>
      </header>

      <main style={{ maxWidth: '1440px', margin: '0 auto', padding: '20px 16px' }}>

        {/* ── Stat Cards ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '10px', marginBottom: '20px' }}>
          <StatCard label="Total Trades" value={trades.length} sub={`${openTrades.length} open · ${closedTrades.length} closed`} accent />
          <StatCard label="Invested Capital" value={`₹${totalInvested.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`} sub="Open positions" color="var(--accent)" />
          <StatCard label="Unrealised P&L" value={`${totalUnrealised >= 0 ? '+' : ''}₹${Math.abs(totalUnrealised).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`} sub="Live (15min delay)" color={totalUnrealised >= 0 ? 'var(--green)' : 'var(--red)'} />
          <StatCard label="Realised P&L" value={`${totalRealised >= 0 ? '+' : ''}₹${Math.abs(totalRealised).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`} sub={`${closedTrades.length} closed trades`} color={totalRealised >= 0 ? 'var(--green)' : 'var(--red)'} />
          <StatCard label="Win Rate" value={winRate !== null ? `${winRate.toFixed(1)}%` : '—'} sub={`${wins.length}W · ${closedTrades.length - wins.length}L`} color={winRate >= 50 ? 'var(--green)' : winRate !== null ? 'var(--red)' : undefined} />
          <StatCard label="MTF Interest" value={`₹${totalMTFInterest.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`} sub="Accrued (all trades)" color="var(--gold)" />
        </div>

        {/* ── Filters ── */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '14px', alignItems: 'center' }}>
          {/* Status filter */}
          <div style={{ display: 'flex', gap: '4px' }}>
            {['ALL', 'OPEN', 'CLOSED'].map(f => (
              <button key={f} onClick={() => setFilter(f)} className={`tab ${filter === f ? 'active' : ''}`}>
                {f}{f === 'ALL' ? ` (${trades.length})` : f === 'OPEN' ? ` (${openTrades.length})` : ` (${closedTrades.length})`}
              </button>
            ))}
          </div>

          {/* Account filter */}
          {accounts.length > 0 && (
            <>
              <span style={{ color: 'var(--border2)', fontSize: '14px' }}>|</span>
              <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                <button onClick={() => setAccountFilter('ALL')} className={`tab ${accountFilter === 'ALL' ? 'active' : ''}`}>All Accounts</button>
                {accounts.map(a => (
                  <button key={a} onClick={() => setAccountFilter(a)} className={`tab ${accountFilter === a ? 'active' : ''}`}>{a}</button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* ── Trades Table ── */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '6px', overflow: 'auto' }}>
          {tradesLoading ? (
            <div style={{ padding: '60px', textAlign: 'center', color: 'var(--muted)' }}>Loading trades...</div>
          ) : filtered.length === 0 ? (
            <div className="empty-state">
              <div className="empty-title">No trades yet</div>
              <div style={{ color: 'var(--muted)', fontSize: '12px', marginBottom: '20px' }}>Click "New Trade" to log your first position</div>
              <button onClick={() => setShowAdd(true)} className="btn btn-primary">+ Add First Trade</button>
            </div>
          ) : (
            <table className="trade-table">
              <thead>
                <tr>
                  <th>Account</th>
                  <th>Ticker</th>
                  <th>Status</th>
                  <th>Dir.</th>
                  <th>Entry Date</th>
                  <th className="right">Entry ₹</th>
                  <th className="right">CMP ₹</th>
                  <th className="right">Exit ₹</th>
                  <th className="right">Qty</th>
                  <th className="right">Invested ₹</th>
                  <th className="right">Pos. Size</th>
                  <th className="right">Unrealised</th>
                  <th className="right">Realised</th>
                  <th>Duration</th>
                  <th className="right">MTF Value ₹</th>
                  <th className="right">MTF Interest ₹</th>
                  <th>Exit Date</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(trade => {
                  const lp = livePrices[trade.ticker]
                  const isOpen = trade.status === 'OPEN'
                  const isLong = trade.direction === 'LONG'

                  // P&L calcs
                  const unrealised = isOpen && lp
                    ? isLong
                      ? (lp.price - trade.entry_price) * trade.quantity
                      : (trade.entry_price - lp.price) * trade.quantity
                    : null

                  const unrealisedPct = unrealised !== null && trade.invested_capital > 0
                    ? (unrealised / trade.invested_capital) * 100 : null

                  // Duration
                  const start = new Date(trade.entry_date)
                  const end = trade.exit_date ? new Date(trade.exit_date) : new Date()
                  const days = Math.max(0, differenceInDays(end, start))

                  // MTF Interest
                  const mtfInterest = trade.mtf_value && trade.mtf_interest_rate
                    ? (trade.mtf_value * trade.mtf_interest_rate * days) / 36500
                    : null

                  // Position size (% of total invested)
                  const posSize = totalInvested > 0 && trade.invested_capital
                    ? (trade.invested_capital / totalInvested) * 100 : null

                  return (
                    <tr key={trade.id}>
                      {/* Account */}
                      <td>
                        <span style={{ fontSize: '11px', color: 'var(--accent)', background: 'rgba(0,212,255,0.07)', padding: '2px 7px', borderRadius: '2px', border: '1px solid rgba(0,212,255,0.15)' }}>
                          {trade.account || '—'}
                        </span>
                      </td>

                      {/* Ticker */}
                      <td>
                        <div className="ticker-symbol">{trade.ticker}</div>
                        <div className="ticker-exchange">NSE</div>
                      </td>

                      {/* Status */}
                      <td><span className={`badge badge-${trade.status.toLowerCase()}`}>{trade.status}</span></td>

                      {/* Direction */}
                      <td><span className={`badge badge-${trade.direction.toLowerCase()}`}>{trade.direction}</span></td>

                      {/* Entry Date */}
                      <td style={{ color: 'var(--muted)', fontSize: '11px' }}>
                        {trade.entry_date ? format(new Date(trade.entry_date), 'dd MMM yy') : '—'}
                      </td>

                      {/* Entry Price */}
                      <td className="right">₹{trade.entry_price?.toLocaleString('en-IN')}</td>

                      {/* CMP */}
                      <td className="right">
                        {isOpen ? (
                          fetchingPrice[trade.ticker] ? (
                            <span style={{ color: 'var(--muted)', fontSize: '10px' }}>...</span>
                          ) : lp ? (
                            <div>
                              <div className={`cmp-price ${lp.change >= 0 ? 'profit' : 'loss'}`}>₹{lp.price?.toLocaleString('en-IN')}</div>
                              <div className={`cmp-change ${lp.change >= 0 ? 'profit' : 'loss'}`}>
                                {lp.change >= 0 ? '+' : ''}{lp.changePercent?.toFixed(2)}%
                              </div>
                            </div>
                          ) : <span style={{ color: 'var(--muted)' }}>—</span>
                        ) : <span style={{ color: 'var(--muted)' }}>—</span>}
                      </td>

                      {/* Exit Price */}
                      <td className="right">
                        {trade.exit_price ? `₹${trade.exit_price.toLocaleString('en-IN')}` : <span style={{ color: 'var(--muted)' }}>—</span>}
                      </td>

                      {/* Qty */}
                      <td className="right">{trade.quantity?.toLocaleString('en-IN')}</td>

                      {/* Invested Capital */}
                      <td className="right">
                        {trade.invested_capital
                          ? `₹${trade.invested_capital.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
                          : '—'}
                      </td>

                      {/* Pos Size */}
                      <td className="right">
                        {posSize !== null && isOpen
                          ? <span style={{ color: 'var(--muted)' }}>{posSize.toFixed(1)}%</span>
                          : <span style={{ color: 'var(--muted)' }}>—</span>}
                      </td>

                      {/* Unrealised Gains */}
                      <td className="right">
                        {unrealised !== null ? (
                          <div>
                            <div className={unrealised >= 0 ? 'profit' : 'loss'} style={{ fontWeight: 500 }}>
                              {unrealised >= 0 ? '+' : '−'}₹{Math.abs(unrealised).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                            </div>
                            <div className={unrealisedPct >= 0 ? 'profit' : 'loss'} style={{ fontSize: '10px', opacity: 0.7 }}>
                              {unrealisedPct >= 0 ? '+' : ''}{unrealisedPct?.toFixed(2)}%
                            </div>
                          </div>
                        ) : <span style={{ color: 'var(--muted)' }}>—</span>}
                      </td>

                      {/* Realised Gains */}
                      <td className="right">
                        {trade.realized_gains != null ? (
                          <span className={trade.realized_gains >= 0 ? 'profit' : 'loss'} style={{ fontWeight: 500 }}>
                            {trade.realized_gains >= 0 ? '+' : '−'}₹{Math.abs(trade.realized_gains).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                          </span>
                        ) : <span style={{ color: 'var(--muted)' }}>—</span>}
                      </td>

                      {/* Duration */}
                      <td style={{ color: 'var(--muted)', fontSize: '11px' }}>{days}d</td>

                      {/* MTF Value */}
                      <td className="right">
                        {trade.mtf_value
                          ? <span style={{ color: 'var(--gold)' }}>₹{trade.mtf_value.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
                          : <span style={{ color: 'var(--muted)' }}>—</span>}
                      </td>

                      {/* MTF Interest */}
                      <td className="right">
                        {mtfInterest != null ? (
                          <div>
                            <div style={{ color: 'var(--gold)', fontWeight: 500 }}>
                              ₹{mtfInterest.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                            </div>
                            <div style={{ fontSize: '9.5px', color: 'var(--muted)' }}>
                              {trade.mtf_interest_rate}% p.a.
                            </div>
                          </div>
                        ) : <span style={{ color: 'var(--muted)' }}>—</span>}
                      </td>

                      {/* Exit Date */}
                      <td style={{ color: 'var(--muted)', fontSize: '11px' }}>
                        {trade.exit_date ? format(new Date(trade.exit_date), 'dd MMM yy') : '—'}
                      </td>

                      {/* Actions */}
                      <td>
                        <div style={{ display: 'flex', gap: '4px' }}>
                          {isOpen && (
                            <button
                              onClick={() => setClosingTrade(trade)}
                              className="icon-btn exit"
                              title="Exit trade"
                            >✓</button>
                          )}
                          <button
                            onClick={() => handleDelete(trade.id)}
                            className="icon-btn del"
                            title="Delete"
                          >×</button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

        <div style={{ marginTop: '12px', textAlign: 'center', color: 'var(--muted)', fontSize: '10px', letterSpacing: '0.06em' }}>
          Prices via Yahoo Finance · ~15 min delay · NSE stocks only · Not financial advice
        </div>
      </main>

      {showAdd && <AddTradeModal session={session} onClose={() => setShowAdd(false)} onAdd={handleAdd} />}
      {closingTrade && <CloseTradeModal trade={closingTrade} onClose={() => setClosingTrade(null)} onConfirm={handleClose} />}
    </>
  )
}
