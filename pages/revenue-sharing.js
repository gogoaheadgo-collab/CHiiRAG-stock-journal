import React, { useState, useEffect, useCallback } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'
import { supabase } from '../lib/supabase'

const ADMIN_EMAIL = 'gogoaheadgo@gmail.com'

function NavPill({ active, isAdmin }) {
  const router = useRouter()
  const items = [
    { label:'Dashboard', path:'/dashboard' },
    { label:'Accounts', path:'/accounts' },
    ...(isAdmin ? [{ label:'Subscribers', path:'/subscribers' }] : []),
    { label:'Revenue Sharing', path:'/revenue-sharing' },
  ]
  return (
    <div style={{ display:'flex', background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'8px', padding:'3px', gap:'2px' }}>
      {items.map(({label,path}) => (
        <button key={path} onClick={() => router.push(path)} style={{
          padding:'7px 22px', borderRadius:'6px', border:'none', cursor:'pointer',
          fontSize:'11px', fontFamily:'DM Mono, monospace', fontWeight:600,
          background:active===label?'var(--accent)':'transparent',
          color:active===label?'#fff':'var(--muted)',
        }}>{label}</button>
      ))}
    </div>
  )
}

export default function RevenueSharingPage() {
  const router = useRouter()
  const [session, setSession] = useState(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)

  // Admin state
  const [subscribers, setSubscribers] = useState([])
  const [selectedSub, setSelectedSub] = useState(null) // { id, name, email }
  const [subTrades, setSubTrades] = useState([])
  const [subExecs, setSubExecs] = useState([])
  const [subLoading, setSubLoading] = useState(false)

  // Subscriber state (own trades)
  const [ownTrades, setOwnTrades] = useState([])
  const [ownExecs, setOwnExecs] = useState([])

  const toINRd = n => Number(n||0).toLocaleString('en-IN', { minimumFractionDigits:2, maximumFractionDigits:2 })
  const toINR  = n => Number(n||0).toLocaleString('en-IN', { maximumFractionDigits:0 })

  const getToken = async () => (await supabase.auth.getSession()).data.session?.access_token

  // ── Auth ──
  useEffect(() => {
    supabase.auth.getSession().then(({ data:{ session:s } }) => {
      if (!s) { router.push('/'); return }
      setSession(s)
      setIsAdmin(s.user.email === ADMIN_EMAIL)
    })
    const { data:{ subscription } } = supabase.auth.onAuthStateChange((_, s) => {
      if (!s) { router.push('/'); return }
      setSession(s)
      setIsAdmin(s.user.email === ADMIN_EMAIL)
    })
    return () => subscription.unsubscribe()
  }, []) // eslint-disable-line

  // ── Load data based on role ──
  useEffect(() => {
    if (!session) return
    if (isAdmin) loadSubscribers()
    else loadOwnTrades()
  }, [session, isAdmin]) // eslint-disable-line

  const loadSubscribers = async () => {
    setLoading(true)
    const token = await getToken()
    const res = await fetch('/api/admin/subscribers', { headers:{ Authorization:`Bearer ${token}` } })
    const data = await res.json()
    if (Array.isArray(data)) {
      // Exclude admin from the tile list
      setSubscribers(data.filter(s => s.email !== ADMIN_EMAIL))
    }
    setLoading(false)
  }

  const loadOwnTrades = async () => {
    setLoading(true)
    const token = await getToken()
    const [tRes, eRes] = await Promise.all([
      fetch('/api/trades', { headers:{ Authorization:`Bearer ${token}` } }),
      fetch('/api/executions', { headers:{ Authorization:`Bearer ${token}` } }),
    ])
    const tData = await tRes.json()
    const eData = await eRes.json()
    if (Array.isArray(tData)) setOwnTrades(tData)
    if (Array.isArray(eData)) setOwnExecs(eData)
    setLoading(false)
  }

  const loadSubTrades = async (sub) => {
    if (selectedSub?.id === sub.id) { setSelectedSub(null); setSubTrades([]); setSubExecs([]); return }
    setSelectedSub(sub)
    setSubTrades([]); setSubExecs([])
    setSubLoading(true)
    const token = await getToken()
    const res = await fetch(`/api/admin/subscriber-trades?user_id=${sub.id}`, { headers:{ Authorization:`Bearer ${token}` } })
    const data = await res.json()
    setSubTrades(data.trades || [])
    setSubExecs(data.executions || [])
    setSubLoading(false)
  }

  const signOut = async () => { await supabase.auth.signOut(); window.location.href = '/' }

  // ── P&L calculation for a trade ──
  const calcTradePnL = (trade, execs) => {
    const investment  = Number(trade.invested_capital) || (Number(trade.entry_price) * Number(trade.quantity))
    const actualInv   = Number(trade.actual_investment) || 0
    const mtfRate     = Number(trade.mtf_interest_rate) || 0
    const entryPrice  = Number(trade.entry_price) || 0
    const originalQty = Number(trade.quantity) || 0
    const tradeExecs  = execs.filter(e => e.trade_id === trade.id)
    const mtfBase     = actualInv > 0 ? investment - actualInv : 0

    // MTF interest
    let mtfInt = 0         // total (open + closed) — for display only
    let mtfIntClosed = 0   // closed portion only — used in Net P&L Admin
    if (mtfBase > 0 && mtfRate && trade.entry_date) {
      const soldMtf = tradeExecs.reduce((s, e) => {
        const days = Math.max(1, Math.floor((new Date(e.date) - new Date(trade.entry_date)) / 86400000))
        return s + mtfBase * (Number(e.quantity) / originalQty) * mtfRate * days / 36500
      }, 0)
      const totalSold = tradeExecs.reduce((s, e) => s + Number(e.quantity), 0)
      const remQty = Math.max(0, originalQty - totalSold)
      const remDays = Math.max(1, Math.floor((new Date() - new Date(trade.entry_date)) / 86400000))
      const remMtf = trade.status === 'OPEN'
        ? mtfBase * (remQty / originalQty) * mtfRate * remDays / 36500
        : 0
      mtfIntClosed = soldMtf + (trade.status === 'CLOSED' ? remMtf : 0)
      mtfInt = soldMtf + remMtf
    }

    // Gross P&L of trade
    let grossPnL = 0
    if (tradeExecs.length > 0) {
      grossPnL = tradeExecs.reduce((s, e) => s + (Number(e.price) - entryPrice) * Number(e.quantity), 0)
    } else {
      grossPnL = Number(trade.realized_gains) || 0
    }
    // For open trades, add unrealised portion (not included — only closed/executed shown)

    // Admin share ratio = (investment - actualInv) / investment = MTF portion
    // Subscriber paid actualInv, admin funded the rest
    const adminRatio = investment > 0 && actualInv > 0 ? (investment - actualInv) / investment : 0

    const grossPnLAdmin = grossPnL * adminRatio   // admin's share of gross profit
    const netPnLAdmin   = grossPnLAdmin - mtfIntClosed  // only closed MTF interest

    const exitPrice = tradeExecs.length > 0
      ? tradeExecs.reduce((s, e) => s + Number(e.price) * Number(e.quantity), 0) /
        tradeExecs.reduce((s, e) => s + Number(e.quantity), 0)
      : Number(trade.exit_price) || null

    return { investment, actualInv, mtfInt, mtfIntClosed, grossPnL, grossPnLAdmin, netPnLAdmin, exitPrice, originalQty, entryPrice, adminRatio }
  }

  // ── Summary stats ──
  const buildSummary = (trades, execs) => {
    const mtfTrades = trades.filter(t => Number(t.actual_investment) > 0)
    return mtfTrades.reduce((acc, t) => {
      const r = calcTradePnL(t, execs)
      return {
        grossPnL:      acc.grossPnL      + r.grossPnL,
        grossPnLAdmin: acc.grossPnLAdmin + r.grossPnLAdmin,
        netPnLAdmin:   acc.netPnLAdmin   + r.netPnLAdmin,
        mtfInt:        acc.mtfInt        + r.mtfInt,           // total MTF (open+closed)
        mtfIntClosed:  acc.mtfIntClosed  + r.mtfIntClosed,    // closed only
        mtfIntOpen:    acc.mtfIntOpen    + (r.mtfInt - r.mtfIntClosed), // open only
        count:         acc.count         + 1,
      }
    }, { grossPnL:0, grossPnLAdmin:0, netPnLAdmin:0, mtfInt:0, mtfIntClosed:0, mtfIntOpen:0, count:0 })
  }

  // ── Render table ──
  const TradeTable = ({ trades, execs }) => {
    const [statusFilter, setStatusFilter] = React.useState('ALL')
    const allMtfTrades = trades.filter(t => Number(t.actual_investment) > 0)
    const mtfTrades = statusFilter === 'ALL' ? allMtfTrades : allMtfTrades.filter(t => t.status === statusFilter)
    if (allMtfTrades.length === 0) return (
      <div style={{ color:'var(--muted)', fontSize:'13px', padding:'24px', textAlign:'center' }}>
        No MTF trades found. Revenue sharing applies only to trades with "Actual Investment" set.
      </div>
    )
    const summary = buildSummary(trades, execs)
    return (
      <div>
        {/* Summary stat cards */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))', gap:'10px', marginBottom:'20px' }}>
          {[
            { label:'Gross P&L (Trade)', value:`${summary.grossPnL>=0?'+':'−'}Rs${toINRd(Math.abs(summary.grossPnL))}`, color:summary.grossPnL>=0?'var(--bull)':'var(--bear)' },
            { label:'Gross P&L (Admin)', value:`${summary.grossPnLAdmin>=0?'+':'−'}Rs${toINRd(Math.abs(summary.grossPnLAdmin))}`, color:summary.grossPnLAdmin>=0?'var(--bull)':'var(--bear)' },
            { label:'MTF Interest (Closed)', value:`Rs${toINRd(summary.mtfIntClosed)}`, color:'var(--gold)' },
            { label:'MTF Interest (Open)', value:`Rs${toINRd(summary.mtfIntOpen)}`, color:'rgba(245,158,11,0.6)' },
            { label:'Net P&L (Admin)', value:`${summary.netPnLAdmin>=0?'+':'−'}Rs${toINRd(Math.abs(summary.netPnLAdmin))}`, color:summary.netPnLAdmin>=0?'var(--bull)':'var(--bear)' },
            { label:'MTF Trades', value:summary.count, color:'var(--text)' },
          ].map(({ label, value, color }) => (
            <div key={label} style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'8px', padding:'14px 16px' }}>
              <div style={{ fontSize:'10px', color:'var(--muted)', fontFamily:'DM Mono, monospace', marginBottom:'6px' }}>{label}</div>
              <div style={{ fontSize:'16px', fontWeight:700, fontFamily:'DM Mono, monospace', color }}>{value}</div>
            </div>
          ))}
        </div>

        {/* Filter tabs */}
        <div style={{ display:'flex', justifyContent:'flex-end', gap:'6px', marginBottom:'10px' }}>
          {['ALL','OPEN','CLOSED'].map(f => (
            <button key={f} onClick={() => setStatusFilter(f)} style={{
              padding:'5px 14px', borderRadius:'4px', cursor:'pointer', fontSize:'10px',
              fontFamily:'DM Mono, monospace', fontWeight:600,
              border:`1px solid ${statusFilter===f?'var(--accent)':'var(--border)'}`,
              background: statusFilter===f ? 'var(--accent-dim)' : 'transparent',
              color: statusFilter===f ? 'var(--accent)' : 'var(--muted)'
            }}>
              {f} ({f==='ALL'?allMtfTrades.length:allMtfTrades.filter(t=>t.status===f).length})
            </button>
          ))}
        </div>

        {/* Trade table */}
        <div style={{ overflowX:'auto', border:'1px solid var(--border)', borderRadius:'8px' }}>
          <table className="trade-table" style={{ width:'100%' }}>
            <thead>
              <tr>
                <th>Ticker</th>
                <th>Entry Date</th>
                <th className="right">Entry Rs</th>
                <th className="right">Exit Rs</th>
                <th className="right">Qty</th>
                <th className="right">Investment</th>
                <th className="right">Actual Inv</th>
                <th className="right">Admin %</th>
                <th className="right">MTF Interest</th>
                <th className="right">Gross P&L</th>
                <th className="right">Gross P&L (Admin)</th>
                <th className="right">Net P&L (Admin)</th>
              </tr>
            </thead>
            <tbody>
              {mtfTrades.map(trade => {
                const r = calcTradePnL(trade, execs)
                return (
                  <tr key={trade.id}>
                    <td>
                      <span className="ticker-badge">{trade.ticker}</span>
                      <div style={{ fontSize:'9px', color:'var(--muted)', marginTop:'2px' }}>
                        <span style={{ fontSize:'9px', fontWeight:700, color:trade.status==='OPEN'?'var(--bull)':'var(--muted)', background:trade.status==='OPEN'?'rgba(0,230,118,0.1)':'var(--surface)', padding:'1px 5px', borderRadius:'3px' }}>{trade.status}</span>
                      </div>
                    </td>
                    <td className="muted">{trade.entry_date?.slice(0,10)}</td>
                    <td className="right">Rs{toINRd(r.entryPrice)}</td>
                    <td className="right">{r.exitPrice ? `Rs${toINRd(r.exitPrice)}` : <span className="neutral">—</span>}</td>
                    <td className="right">{toINR(r.originalQty)}</td>
                    <td className="right">Rs{toINRd(r.investment)}</td>
                    <td className="right">Rs{toINRd(r.actualInv)}</td>
                    <td className="right" style={{ color:'var(--gold)', fontWeight:600 }}>
                      {(r.adminRatio*100).toFixed(1)}%
                    </td>
                    <td className="right" style={{ color:'var(--gold)' }}>
                      {r.mtfInt > 0 ? `Rs${toINRd(r.mtfInt)}` : <span className="neutral">—</span>}
                    </td>
                    <td className="right">
                      <span style={{ fontWeight:600, color:r.grossPnL>=0?'var(--bull)':'var(--bear)' }}>
                        {r.grossPnL>=0?'+':'−'}Rs{toINRd(Math.abs(r.grossPnL))}
                      </span>
                    </td>
                    <td className="right">
                      <span style={{ fontWeight:600, color:r.grossPnLAdmin>=0?'var(--bull)':'var(--bear)' }}>
                        {r.grossPnLAdmin>=0?'+':'−'}Rs{toINRd(Math.abs(r.grossPnLAdmin))}
                      </span>
                    </td>
                    <td className="right">
                      <span style={{ fontWeight:700, fontSize:'13px', color:r.netPnLAdmin>=0?'var(--bull)':'var(--bear)', background:r.netPnLAdmin>=0?'rgba(0,230,118,0.06)':'rgba(239,68,68,0.06)', padding:'2px 8px', borderRadius:'4px' }}>
                        {r.netPnLAdmin>=0?'+':'−'}Rs{toINRd(Math.abs(r.netPnLAdmin))}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <div style={{ fontSize:'10px', color:'var(--muted)', marginTop:'8px', fontFamily:'DM Mono, monospace' }}>
          Admin % = (Investment − Actual Inv) ÷ Investment &nbsp;·&nbsp; Gross P&L Admin = Trade Gross P&L × Admin% &nbsp;·&nbsp; Net P&L Admin = Gross P&L Admin − MTF Interest
        </div>
      </div>
    )
  }

  if (!session) return null

  return (
    <>
      <Head><title>Revenue Sharing — CHiiRAG Stock Journal</title></Head>
      <div className="tricolor-bar" />

      <header className="header" style={{ top:'4px' }}>
        <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
          <div className="india-flag-logo-sm" style={{ display:'flex', flexDirection:'column' }}>
            <div style={{ flex:1, background:'#FF9933' }} />
            <div style={{ flex:1, background:'#fff', display:'flex', alignItems:'center', justifyContent:'center' }}>
              <div style={{ width:'8px', height:'8px', borderRadius:'50%', border:'1.5px solid #000080' }} />
            </div>
            <div style={{ flex:1, background:'#138808' }} />
          </div>
          <div style={{ fontFamily:'Bookman Old Style, serif', fontWeight:800, fontSize:'15px', color:'var(--text)' }}>
            CHiiRAG <span style={{ color:'var(--accent)' }}>STOCK Journal</span>
          </div>
        </div>
        <NavPill active="Revenue Sharing" isAdmin={isAdmin} />
        <div style={{ display:'flex', gap:'8px', alignItems:'center' }}>
          <button onClick={signOut} className="btn btn-ghost" style={{ padding:'6px 10px', fontSize:'11px' }}>Sign Out</button>
        </div>
      </header>

      <main style={{ maxWidth:'1400px', margin:'0 auto', padding:'80px 16px 40px' }}>

        <div style={{ marginBottom:'24px' }}>
          <h1 style={{ fontFamily:'Bookman Old Style, serif', fontSize:'22px', fontWeight:800, color:'var(--text)', margin:0 }}>
            Revenue Sharing
          </h1>
          <p style={{ color:'var(--muted)', fontSize:'12px', marginTop:'6px', fontFamily:'DM Mono, monospace' }}>
            MTF profit sharing — tracks admin's gross & net P&L across subscriber portfolios
          </p>
        </div>

        {loading ? (
          <div style={{ color:'var(--muted)', padding:'40px', textAlign:'center' }}>Loading...</div>
        ) : isAdmin ? (
          /* ── ADMIN VIEW ── */
          <div>
            {/* Subscriber tiles */}
            <div style={{ display:'flex', gap:'10px', flexWrap:'wrap', marginBottom:'28px' }}>
              {subscribers.length === 0 ? (
                <div style={{ color:'var(--muted)', fontSize:'13px' }}>No subscribers found.</div>
              ) : subscribers.map(sub => {
                const isSelected = selectedSub?.id === sub.id
                return (
                  <div key={sub.id} onClick={() => loadSubTrades(sub)}
                    style={{ border:`2px solid ${isSelected?'var(--accent)':'var(--border)'}`,
                      background: isSelected ? 'var(--accent-dim)' : 'var(--surface)',
                      borderRadius:'10px', padding:'14px 20px', cursor:'pointer', minWidth:'140px',
                      transition:'all 0.15s' }}
                    onMouseEnter={e => { if (!isSelected) e.currentTarget.style.borderColor='var(--accent)' }}
                    onMouseLeave={e => { if (!isSelected) e.currentTarget.style.borderColor='var(--border)' }}>
                    <div style={{ fontFamily:'DM Mono, monospace', fontWeight:700, fontSize:'13px', color: isSelected?'var(--accent)':'var(--text)' }}>
                      {sub.full_name || sub.email?.split('@')[0]}
                    </div>
                    <div style={{ fontSize:'10px', color:'var(--muted)', marginTop:'4px' }}>
                      {sub.totalTrades} trades
                    </div>
                    <div style={{ fontSize:'9px', color: isSelected?'var(--accent)':'var(--muted)', marginTop:'2px', fontFamily:'DM Mono, monospace' }}>
                      {isSelected ? '▼ viewing' : '▶ click to view'}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Selected subscriber trades */}
            {selectedSub && (
              <div style={{ borderTop:'2px solid var(--accent)', paddingTop:'24px' }}>
                <div style={{ display:'flex', alignItems:'center', gap:'12px', marginBottom:'20px' }}>
                  <h2 style={{ fontFamily:'Bookman Old Style, serif', fontSize:'17px', fontWeight:700, margin:0, color:'var(--text)' }}>
                    {selectedSub.full_name || selectedSub.email}'s Revenue Share
                  </h2>
                  <span style={{ fontSize:'10px', background:'var(--accent-dim)', color:'var(--accent)', padding:'2px 8px', borderRadius:'4px', fontFamily:'DM Mono, monospace' }}>
                    MTF TRADES ONLY
                  </span>
                </div>
                {subLoading ? (
                  <div style={{ color:'var(--muted)', padding:'20px' }}>Loading trades...</div>
                ) : (
                  <TradeTable trades={subTrades} execs={subExecs} />
                )}
              </div>
            )}
          </div>
        ) : (
          /* ── SUBSCRIBER VIEW ── */
          <div>
            <div style={{ marginBottom:'20px', display:'flex', alignItems:'center', gap:'10px' }}>
              <h2 style={{ fontFamily:'Bookman Old Style, serif', fontSize:'17px', fontWeight:700, margin:0 }}>
                My Revenue Share
              </h2>
              <span style={{ fontSize:'10px', background:'var(--accent-dim)', color:'var(--accent)', padding:'2px 8px', borderRadius:'4px', fontFamily:'DM Mono, monospace' }}>
                MTF TRADES ONLY
              </span>
            </div>
            <TradeTable trades={ownTrades} execs={ownExecs} />
          </div>
        )}
      </main>
    </>
  )
}
