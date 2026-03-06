import { useState, useEffect, useCallback } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'
import { supabase } from '../lib/supabase'
import AddTradeModal from '../components/AddTradeModal'
import CloseTradeModal from '../components/CloseTradeModal'
import { differenceInDays, format } from 'date-fns'

// ─── Nav Pill ─────────────────────────────────────────────────────────────────
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
          padding: '7px 22px', borderRadius: '6px', border: 'none', cursor: 'pointer',
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

// ─── Helpers ──────────────────────────────────────────────────────────────────
const toIndian = (n) => Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })
const toIndianDec = (n) => Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })

const getToken = async () => (await supabase.auth.getSession()).data.session?.access_token

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function AccountsPage() {
  const router = useRouter()
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [trades, setTrades] = useState([])
  const [accounts, setAccounts] = useState([])
  const [activeAccount, setActiveAccount] = useState(null)
  const [filter, setFilter] = useState('ALL')
  const [livePrices, setLivePrices] = useState({})
  const [showAdd, setShowAdd] = useState(false)
  const [closingTrade, setClosingTrade] = useState(null)
  const [showNewAccount, setShowNewAccount] = useState(false)
  const [newAccountName, setNewAccountName] = useState('')
  const [countdown, setCountdown] = useState(60)

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

  const loadData = useCallback(async () => {
    if (!session) return
    setLoading(true)
    const token = await getToken()

    const [tradesRes, accountsRes] = await Promise.all([
      fetch('/api/trades', { headers: { Authorization: `Bearer ${token}` } }),
      fetch('/api/accounts', { headers: { Authorization: `Bearer ${token}` } }),
    ])

    const tradesData = await tradesRes.json()
    const accountsData = await accountsRes.json()

    if (Array.isArray(tradesData)) setTrades(tradesData)
    if (Array.isArray(accountsData)) {
      setAccounts(accountsData)
      if (accountsData.length > 0 && !activeAccount) {
        setActiveAccount(accountsData[0].name)
      }
    }
    setLoading(false)
  }, [session])

  useEffect(() => { if (session) loadData() }, [session, loadData])

  // Live prices for open trades
  const fetchPrice = useCallback(async (ticker) => {
    try {
      const token = await getToken()
      const res = await fetch(`/api/stock/${ticker}`, { headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      if (data.price) setLivePrices(prev => ({ ...prev, [ticker]: data }))
    } catch (e) {}
  }, [])

  useEffect(() => {
    if (!session || !activeAccount) return
    const openInAccount = trades.filter(t => t.status === 'OPEN' && t.account === activeAccount)
    const symbols = [...new Set(openInAccount.map(t => t.ticker))]
    symbols.forEach(fetchPrice)
  }, [trades, activeAccount, session])

  // Countdown timer
  useEffect(() => {
    const timer = setInterval(() => setCountdown(c => c <= 1 ? 60 : c - 1), 1000)
    return () => clearInterval(timer)
  }, [])

  // Auto refresh
  useEffect(() => {
    if (countdown === 60 && session && activeAccount) {
      const openInAccount = trades.filter(t => t.status === 'OPEN' && t.account === activeAccount)
      const symbols = [...new Set(openInAccount.map(t => t.ticker))]
      symbols.forEach(fetchPrice)
    }
  }, [countdown])

  const handleAddTrade = async (tradeData) => {
    const token = await getToken()
    const res = await fetch('/api/trades', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ ...tradeData, account: activeAccount }),
    })
    const data = await res.json()
    if (data.error) throw new Error(data.error)
    await loadData()
  }

  const handleClose = async (payload) => {
    const token = await getToken()
    await fetch('/api/trades', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ id: closingTrade.id, ...payload.updates }),
    })
    if (payload.type === 'partial') {
      await fetch('/api/trades', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          account: closingTrade.account,
          ticker: closingTrade.ticker,
          direction: closingTrade.direction,
          entry_date: closingTrade.entry_date,
          entry_price: closingTrade.entry_price,
          quantity: payload.remaining.quantity,
          invested_capital: payload.remaining.invested_capital,
          actual_investment: payload.remaining.actual_investment,
          mtf_value: payload.remaining.mtf_value,
          mtf_interest_rate: closingTrade.mtf_interest_rate,
          entry_reason: closingTrade.entry_reason,
          setup_pattern: closingTrade.setup_pattern,
          status: 'OPEN',
        }),
      })
    }
    setClosingTrade(null)
    await loadData()
  }

  const handleDelete = async (id) => {
    if (!confirm('Delete this trade?')) return
    const token = await getToken()
    await fetch('/api/trades', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ id }),
    })
    await loadData()
  }

  const handleCreateAccount = async () => {
    if (!newAccountName.trim()) return
    const token = await getToken()
    const res = await fetch('/api/accounts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ name: newAccountName.trim().toUpperCase() }),
    })
    const data = await res.json()
    if (!data.error) {
      setNewAccountName('')
      setShowNewAccount(false)
      setActiveAccount(newAccountName.trim().toUpperCase())
      await loadData()
    }
  }

  const handleDeleteAccount = async (accountName) => {
    if (!confirm(`Delete account "${accountName}"? All trades in this account will also be deleted.`)) return
    const token = await getToken()
    const acc = accounts.find(a => a.name === accountName)
    if (acc) {
      await fetch('/api/accounts', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ id: acc.id }),
      })
    }
    setActiveAccount(accounts.find(a => a.name !== accountName)?.name || null)
    await loadData()
  }

  const signOut = () => supabase.auth.signOut().then(() => router.push('/'))

  // ── Filtered trades for active account ──
  const accountTrades = trades.filter(t => t.account === activeAccount)
  const filtered = accountTrades.filter(t => filter === 'ALL' || t.status === filter)
  const openTrades = accountTrades.filter(t => t.status === 'OPEN')
  const closedTrades = accountTrades.filter(t => t.status === 'CLOSED')

  const totalRealised = closedTrades.reduce((s, t) => s + (t.realized_gains || 0), 0)
  const totalMTF = openTrades.reduce((s, t) => {
    if (!t.mtf_value || !t.mtf_interest_rate || !t.entry_date) return 0
    const days = Math.max(1, differenceInDays(new Date(), new Date(t.entry_date)))
    return s + (t.mtf_value * t.mtf_interest_rate * days) / 36500
  }, 0)

  if (!session) return null

  return (
    <>
      <Head><title>Accounts — Chiirag Stock Journal</title></Head>

      {/* Header */}
      <header className="header">
        <NavPill active="Accounts" />
        <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: '15px', color: 'var(--text)', letterSpacing: '-0.02em' }}>
          CHiiRAG <span style={{ color: 'var(--accent)' }}>STOCK Journal</span>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {openTrades.length > 0 && (
            <span style={{ fontSize: '10px', color: 'var(--muted)', fontFamily: 'IBM Plex Mono, monospace' }}>
              ↻ {countdown}s
            </span>
          )}
          <button onClick={() => setShowAdd(true)} className="btn btn-primary" style={{ padding: '6px 14px', fontSize: '11px' }}>
            + New Trade
          </button>
          <button onClick={signOut} className="btn btn-ghost" style={{ padding: '6px 10px', fontSize: '11px' }}>Sign Out</button>
        </div>
      </header>

      <main style={{ maxWidth: '1400px', margin: '0 auto', padding: '20px 16px' }}>

        {/* Account Tabs */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
          {accounts.map(acc => (
            <div key={acc.id} style={{
              position: 'relative',
              border: `2px solid ${activeAccount === acc.name ? 'var(--accent)' : 'var(--border)'}`,
              background: activeAccount === acc.name ? 'rgba(0,212,255,0.08)' : 'var(--surface)',
              borderRadius: '10px', transition: 'all 0.15s', minWidth: '120px',
            }}>
              {/* Main click area */}
              <button
                onClick={() => setActiveAccount(acc.name)}
                style={{
                  width: '100%', padding: '14px 16px 10px',
                  background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left',
                }}
              >
                <div style={{
                  fontSize: '14px', fontWeight: 700, letterSpacing: '0.1em',
                  fontFamily: 'IBM Plex Mono, monospace',
                  color: activeAccount === acc.name ? 'var(--accent)' : 'var(--text)',
                }}>{acc.name}</div>
                <div style={{ fontSize: '10px', color: 'var(--muted)', marginTop: '3px' }}>
                  {trades.filter(t => t.account === acc.name).length} trades
                </div>
              </button>
              {/* Edit + Delete buttons inside tile */}
              <div style={{ display: 'flex', borderTop: '1px solid var(--border)', }}>
                <button
                  onClick={() => {
                    const newName = prompt('Rename account:', acc.name)
                    if (newName && newName.trim() && newName.trim().toUpperCase() !== acc.name) {
                      getToken().then(token =>
                        fetch('/api/accounts', {
                          method: 'PUT',
                          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                          body: JSON.stringify({ id: acc.id, name: newName.trim().toUpperCase() }),
                        }).then(() => loadData())
                      )
                    }
                  }}
                  style={{
                    flex: 1, padding: '6px', background: 'none', border: 'none',
                    borderRight: '1px solid var(--border)',
                    color: 'var(--muted)', cursor: 'pointer', fontSize: '11px',
                    transition: 'color 0.1s',
                  }}
                  title="Rename"
                >✎</button>
                <button
                  onClick={() => handleDeleteAccount(acc.name)}
                  style={{
                    flex: 1, padding: '6px', background: 'none', border: 'none',
                    color: 'var(--muted)', cursor: 'pointer', fontSize: '13px',
                    transition: 'color 0.1s',
                  }}
                  title="Delete account"
                >🗑</button>
              </div>
            </div>
          ))}

          {/* New account button */}
          {showNewAccount ? (
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              <input
                value={newAccountName}
                onChange={e => setNewAccountName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleCreateAccount()}
                placeholder="ACCOUNT NAME"
                autoFocus
                style={{
                  background: 'var(--surface)', border: '1px solid var(--accent)', borderRadius: '6px',
                  padding: '6px 12px', color: 'var(--text)', fontSize: '11px',
                  fontFamily: 'IBM Plex Mono, monospace', width: '140px', letterSpacing: '0.08em',
                  outline: 'none',
                }}
              />
              <button onClick={handleCreateAccount} className="btn btn-primary" style={{ padding: '6px 12px', fontSize: '11px' }}>Add</button>
              <button onClick={() => { setShowNewAccount(false); setNewAccountName('') }} className="btn btn-ghost" style={{ padding: '6px 10px', fontSize: '11px' }}>✕</button>
            </div>
          ) : (
            <button
              onClick={() => setShowNewAccount(true)}
              style={{
                padding: '7px 14px', borderRadius: '6px',
                border: '1px dashed var(--border)', background: 'transparent',
                color: 'var(--muted)', cursor: 'pointer', fontSize: '11px',
                fontFamily: 'IBM Plex Mono, monospace', transition: 'all 0.15s',
              }}
            >
              + New Account
            </button>
          )}
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px', color: 'var(--muted)' }}>Loading...</div>
        ) : !activeAccount ? (
          <div style={{ textAlign: 'center', padding: '80px', color: 'var(--muted)' }}>
            <div style={{ fontSize: '32px', marginBottom: '12px' }}>📂</div>
            <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: '16px', marginBottom: '8px', color: 'var(--text)' }}>No Accounts Yet</div>
            <div style={{ fontSize: '11px' }}>Click "+ New Account" to create your first portfolio account</div>
          </div>
        ) : (
          <>
            {/* Account Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '10px', marginBottom: '18px' }}>
              <div className="stat-card">
                <div style={{ fontSize: '9px', color: 'var(--muted)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '6px' }}>Realised P&L</div>
                <div style={{ fontSize: '20px', fontWeight: 700, fontFamily: 'Syne, sans-serif', color: totalRealised >= 0 ? 'var(--green)' : 'var(--red)' }}>
                  {totalRealised >= 0 ? '+' : '−'}₹{toIndian(Math.abs(totalRealised))}
                </div>
              </div>
              <div className="stat-card">
                <div style={{ fontSize: '9px', color: 'var(--muted)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '6px' }}>Open Positions</div>
                <div style={{ fontSize: '20px', fontWeight: 700, fontFamily: 'Syne, sans-serif', color: 'var(--accent)' }}>{openTrades.length}</div>
              </div>
              <div className="stat-card">
                <div style={{ fontSize: '9px', color: 'var(--muted)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '6px' }}>Closed Trades</div>
                <div style={{ fontSize: '20px', fontWeight: 700, fontFamily: 'Syne, sans-serif', color: 'var(--text)' }}>{closedTrades.length}</div>
              </div>
              <div className="stat-card">
                <div style={{ fontSize: '9px', color: 'var(--muted)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '6px' }}>MTF Interest</div>
                <div style={{ fontSize: '20px', fontWeight: 700, fontFamily: 'Syne, sans-serif', color: 'var(--gold)' }}>₹{toIndianDec(totalMTF)}</div>
              </div>
            </div>

            {/* Filter */}
            <div style={{ display: 'flex', gap: '6px', marginBottom: '14px' }}>
              {['ALL', 'OPEN', 'CLOSED'].map(f => (
                <button key={f} onClick={() => setFilter(f)} style={{
                  padding: '5px 14px', borderRadius: '4px', border: `1px solid ${filter === f ? 'var(--accent)' : 'var(--border)'}`,
                  background: filter === f ? 'rgba(0,212,255,0.08)' : 'transparent',
                  color: filter === f ? 'var(--accent)' : 'var(--muted)',
                  cursor: 'pointer', fontSize: '10px', fontFamily: 'IBM Plex Mono, monospace',
                  fontWeight: 600, letterSpacing: '0.08em',
                }}>
                  {f} {f === 'ALL' ? `(${accountTrades.length})` : f === 'OPEN' ? `(${openTrades.length})` : `(${closedTrades.length})`}
                </button>
              ))}
            </div>

            {/* Trade Table */}
            {filtered.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px', color: 'var(--muted)', border: '1px dashed var(--border)', borderRadius: '8px' }}>
                <div style={{ fontSize: '11px' }}>No trades in {activeAccount}. Click "+ New Trade" to add one.</div>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table className="trade-table">
                  <thead>
                    <tr>
                      <th>Ticker</th>
                      <th>Dir</th>
                      <th>Entry Date</th>
                      <th className="right">Entry ₹</th>
                      <th className="right">Qty</th>
                      <th className="right">Invested ₹</th>
                      <th className="right">Actual Inv ₹</th>
                      <th className="right">CMP ₹</th>
                      <th className="right">Exit ₹</th>
                      <th className="right">MTF Int ₹</th>
                      <th className="right">P&L ₹</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(trade => {
                      const isOpen = trade.status === 'OPEN'
                      const lp = livePrices[trade.ticker]

                      const days = trade.entry_date
                        ? Math.max(1, differenceInDays(new Date(), new Date(trade.entry_date)))
                        : 0
                      const mtfInterest = trade.mtf_value && trade.mtf_interest_rate
                        ? (trade.mtf_value * trade.mtf_interest_rate * days) / 36500
                        : null

                      const unrealised = isOpen && lp?.price && trade.entry_price && trade.quantity
                        ? trade.direction === 'LONG'
                          ? (lp.price - trade.entry_price) * trade.quantity
                          : (trade.entry_price - lp.price) * trade.quantity
                        : null

                      return (
                        <tr key={trade.id} className={isOpen ? 'row-open' : 'row-closed'}>
                          <td><span className="ticker-badge">{trade.ticker}</span></td>
                          <td><span className={`badge badge-${trade.direction.toLowerCase()}`}>{trade.direction}</span></td>
                          <td className="muted">{trade.entry_date?.slice(0, 10)}</td>
                          <td className="right" style={{ fontFamily: 'Noto Sans, sans-serif' }}>₹{toIndian(trade.entry_price)}</td>
                          <td className="right">{toIndian(trade.quantity)}</td>
                          <td className="right">{trade.invested_capital ? `₹${toIndian(trade.invested_capital)}` : <span className="neutral">—</span>}</td>
                          <td className="right">{trade.actual_investment ? `₹${toIndian(trade.actual_investment)}` : <span className="neutral">—</span>}</td>
                          <td className="right">
                            {isOpen && lp ? (
                              <div>
                                <div style={{ fontFamily: 'Noto Sans, sans-serif' }}>₹{toIndian(lp.price)}</div>
                                <div className={`cmp-price ${lp.change >= 0 ? 'profit' : 'loss'}`}>
                                  {lp.change >= 0 ? '+' : ''}{lp.changePercent?.toFixed(2)}%
                                </div>
                              </div>
                            ) : <span className="neutral">—</span>}
                          </td>
                          <td className="right">{trade.exit_price ? `₹${toIndian(trade.exit_price)}` : <span className="neutral">—</span>}</td>
                          <td className="right">
                            {mtfInterest ? (
                              <div style={{ color: 'var(--gold)', fontFamily: 'Noto Sans, sans-serif' }}>₹{toIndianDec(mtfInterest)}</div>
                            ) : <span className="neutral">—</span>}
                          </td>
                          <td className="right">
                            {isOpen && unrealised !== null ? (
                              <div style={{ color: unrealised >= 0 ? 'var(--green)' : 'var(--red)', fontFamily: 'Noto Sans, sans-serif' }}>
                                {unrealised >= 0 ? '+' : '−'}₹{toIndian(Math.abs(unrealised))}
                              </div>
                            ) : trade.realized_gains != null ? (
                              <div style={{ color: trade.realized_gains >= 0 ? 'var(--green)' : 'var(--red)', fontFamily: 'Noto Sans, sans-serif' }}>
                                {trade.realized_gains >= 0 ? '+' : '−'}₹{toIndian(Math.abs(trade.realized_gains))}
                              </div>
                            ) : <span className="neutral">—</span>}
                          </td>
                          <td><span className={`badge badge-${trade.status.toLowerCase()}`}>{trade.status}</span></td>
                          <td>
                            <div style={{ display: 'flex', gap: '4px' }}>
                              {isOpen && (
                                <button onClick={() => setClosingTrade(trade)} className="icon-btn exit" title="Close trade">✓</button>
                              )}
                              <button onClick={() => handleDelete(trade.id)} className="icon-btn del" title="Delete">×</button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </main>

      {showAdd && (
        <AddTradeModal
          accounts={accounts}
          defaultAccount={activeAccount}
          onClose={() => setShowAdd(false)}
          onSave={handleAddTrade}
        />
      )}
      {closingTrade && (
        <CloseTradeModal
          trade={closingTrade}
          onClose={() => setClosingTrade(null)}
          onConfirm={handleClose}
        />
      )}
    </>
  )
}
