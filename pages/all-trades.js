import React, { useState, useEffect, useCallback } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'
import { supabase } from '../lib/supabase'
import { differenceInDays } from 'date-fns'

const ADMIN_EMAIL = 'gogoaheadgo@gmail.com'

function NavPill({ active, isAdmin }) {
  const router = useRouter()
  const items = [
    { label:'Dashboard', path:'/dashboard' },
    { label:'Accounts', path:'/accounts' },
    ...(isAdmin ? [
      { label:'Subscribers', path:'/subscribers' },
      { label:'All Trades', path:'/all-trades' },
    ] : []),
    { label:'Revenue Sharing', path:'/revenue-sharing' },
  ]
  return (
    <div style={{ display:'flex', background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'8px', padding:'3px', gap:'2px', flexWrap:'wrap' }}>
      {items.map(({label,path}) => (
        <button key={path} onClick={() => router.push(path)} style={{
          padding:'7px 18px', borderRadius:'6px', border:'none', cursor:'pointer',
          fontSize:'11px', fontFamily:'DM Mono, monospace', fontWeight:600,
          background:active===label?'var(--accent)':'transparent',
          color:active===label?'#fff':'var(--muted)',
        }}>{label}</button>
      ))}
    </div>
  )
}

export default function AllTradesPage() {
  const router = useRouter()
  const [session, setSession]       = useState(null)
  const [isAdmin, setIsAdmin]       = useState(false)
  const [loading, setLoading]       = useState(true)

  // Own trades
  const [ownTrades, setOwnTrades]   = useState([])
  const [ownExecs, setOwnExecs]     = useState({})   // map trade_id → []

  // Subscriber trades: [{subInfo, trades, execs}]
  const [subGroups, setSubGroups]   = useState([])

  const [livePrices, setLivePrices] = useState({})
  const [statusFilter, setStatusFilter] = useState('ALL')

  const toINRd = n => Number(n||0).toLocaleString('en-IN', { minimumFractionDigits:2, maximumFractionDigits:2 })
  const toINR  = n => Number(n||0).toLocaleString('en-IN', { maximumFractionDigits:0 })
  const getToken = async () => (await supabase.auth.getSession()).data.session?.access_token

  const fetchPrice = useCallback(async (ticker) => {
    try {
      const res = await fetch(`/api/stock/${ticker}`)
      const data = await res.json()
      if (data.price) setLivePrices(prev => ({ ...prev, [ticker]: data }))
    } catch {}
  }, [])

  // ── Auth ──
  useEffect(() => {
    supabase.auth.getSession().then(({ data:{ session:s } }) => {
      if (!s) { router.push('/'); return }
      if (s.user.email !== ADMIN_EMAIL) { router.push('/dashboard'); return } // subscriber redirect
      setSession(s)
      setIsAdmin(true)
    })
    const { data:{ subscription } } = supabase.auth.onAuthStateChange((event, s) => {
      if (!s) router.push('/')
    })
    return () => subscription.unsubscribe()
  }, []) // eslint-disable-line

  // ── Load all data ──
  useEffect(() => {
    if (!session) return
    loadAll()
  }, [session]) // eslint-disable-line

  const loadAll = async () => {
    setLoading(true)
    const token = await getToken()

    // 1. Own trades + executions
    const tRes = await fetch('/api/trades', { headers:{ Authorization:`Bearer ${token}` } })
    const tData = await tRes.json()
    if (Array.isArray(tData)) {
      setOwnTrades(tData)
      const execResults = await Promise.all(
        tData.map(t => fetch(`/api/executions?trade_id=${t.id}`, { headers:{ Authorization:`Bearer ${token}` } }).then(r=>r.json()).catch(()=>[]))
      )
      const execMap = {}
      tData.forEach((t, i) => { if (Array.isArray(execResults[i])) execMap[t.id] = execResults[i] })
      setOwnExecs(execMap)
      // Fetch prices for own open trades
      const symbols = [...new Set(tData.filter(t=>t.status==='OPEN').map(t=>t.ticker))]
      symbols.forEach(fetchPrice)
    }

    // 2. All subscribers
    const sRes = await fetch('/api/admin/subscribers', { headers:{ Authorization:`Bearer ${token}` } })
    const sData = await sRes.json()
    if (Array.isArray(sData)) {
      const nonAdmin = sData.filter(s => s.email !== ADMIN_EMAIL)
      const groups = await Promise.all(nonAdmin.map(async sub => {
        const res = await fetch(`/api/admin/subscriber-trades?user_id=${sub.id}`, { headers:{ Authorization:`Bearer ${token}` } })
        const d = await res.json()
        const trades = d.trades || []
        const execs  = d.executions || []
        // Fetch prices for subscriber open trades
        const syms = [...new Set(trades.filter(t=>t.status==='OPEN').map(t=>t.ticker))]
        syms.forEach(fetchPrice)
        // Build exec map
        const execMap = {}
        trades.forEach(t => { execMap[t.id] = execs.filter(e=>e.trade_id===t.id) })
        return { sub, trades, execMap }
      }))
      setSubGroups(groups)
    }

    setLoading(false)
  }

  const signOut = async () => { await supabase.auth.signOut(); window.location.href = '/' }

  // ── Per-trade calculations ──
  const calcRow = (trade, execMap) => {
    const execs       = execMap[trade.id] || []
    const totalSold   = execs.reduce((s,e) => s + Number(e.quantity), 0)
    const originalQty = Number(trade.quantity) || 0
    const currentQty  = Math.max(0, originalQty - totalSold)
    const entryPrice  = Number(trade.entry_price) || 0
    const investment  = Number(trade.invested_capital) || (entryPrice * originalQty)
    const actualInv   = Number(trade.actual_investment) || 0
    const mtfBase     = actualInv > 0 ? investment - actualInv : 0
    const lp          = livePrices[trade.ticker]
    const cmp         = lp?.price

    // MTF interest
    let mtfInt = 0
    if (mtfBase > 0 && trade.mtf_interest_rate && trade.entry_date) {
      const soldMtf = execs.reduce((s, e) => {
        const days = Math.max(1, Math.floor((new Date(e.date) - new Date(trade.entry_date)) / 86400000))
        return s + mtfBase * (Number(e.quantity)/originalQty) * trade.mtf_interest_rate * days / 36500
      }, 0)
      const remDays = Math.max(1, differenceInDays(new Date(), new Date(trade.entry_date)))
      const remMtf = trade.status === 'OPEN'
        ? mtfBase * (currentQty/originalQty) * trade.mtf_interest_rate * remDays / 36500
        : 0
      mtfInt = soldMtf + remMtf
    }

    // Realised P&L
    const realisedPnL = execs.length > 0
      ? execs.reduce((s,e) => s + (Number(e.price) - entryPrice) * Number(e.quantity), 0)
      : (Number(trade.realized_gains) || 0)

    // Unrealised P&L
    const unrealisedPnL = cmp && currentQty > 0
      ? (trade.direction === 'SHORT' ? (entryPrice - cmp) * currentQty : (cmp - entryPrice) * currentQty)
      : null

    const exitPrice = currentQty===0 && execs.length>0
      ? execs.reduce((s,e)=>s+Number(e.price)*Number(e.quantity),0) / totalSold
      : (Number(trade.exit_price) || null)

    return { execs, totalSold, originalQty, currentQty, entryPrice, investment, actualInv, mtfInt, realisedPnL, unrealisedPnL, exitPrice, lp, cmp }
  }

  // ── Aggregate stats ──
  const calcStats = (trades, execMap) => {
    let unr = 0, rel = 0, open = 0, closed = 0
    trades.forEach(t => {
      const r = calcRow(t, execMap)
      if (t.status === 'OPEN') { open++; if (r.unrealisedPnL !== null) unr += r.unrealisedPnL }
      else { closed++; rel += r.realisedPnL }
    })
    return { unr, rel, open, closed }
  }

  // All subscriber trades + execMaps merged
  const allSubTrades  = subGroups.flatMap(g => g.trades)
  const mergedSubExec = Object.assign({}, ...subGroups.map(g => g.execMap))

  const adminStats = calcStats(ownTrades, ownExecs)
  const subStats   = calcStats(allSubTrades, mergedSubExec)

  // Combined flat list for table (own + subscriber, tagged)
  const allRows = [
    ...ownTrades.map(t => ({ trade:t, execMap:ownExecs, isSub:false, subName:null })),
    ...subGroups.flatMap(g => g.trades.map(t => ({ trade:t, execMap:g.execMap, isSub:true, subName:g.sub.full_name || g.sub.email?.split('@')[0] })))
  ]
  const filtered = allRows.filter(r => statusFilter==='ALL' || r.trade.status===statusFilter)

  const pnlColor = n => n >= 0 ? 'var(--bull)' : 'var(--bear)'
  const pnlSign  = n => n >= 0 ? '+' : '−'

  if (!session) return null

  const StatTile = ({ label, adminVal, subVal, adminColor, subColor }) => (
    <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'10px', padding:'16px 18px', minWidth:'180px' }}>
      <div style={{ fontSize:'10px', color:'var(--muted)', fontFamily:'DM Mono, monospace', marginBottom:'10px', letterSpacing:'0.05em' }}>{label}</div>
      <div style={{ display:'flex', flexDirection:'column', gap:'6px' }}>
        <div>
          <div style={{ fontSize:'9px', color:'var(--muted)', fontFamily:'DM Mono, monospace', marginBottom:'2px' }}>ADMIN</div>
          <div style={{ fontSize:'15px', fontWeight:800, fontFamily:'DM Mono, monospace', color:adminColor||'var(--text)' }}>{adminVal}</div>
        </div>
        <div style={{ borderTop:'1px solid var(--border)', paddingTop:'6px' }}>
          <div style={{ fontSize:'9px', color:'var(--gold)', fontFamily:'DM Mono, monospace', marginBottom:'2px' }}>SUBSCRIBERS</div>
          <div style={{ fontSize:'15px', fontWeight:800, fontFamily:'DM Mono, monospace', color:subColor||'var(--gold)' }}>{subVal}</div>
        </div>
      </div>
    </div>
  )

  return (
    <>
      <Head><title>All Trades — CHiiRAG Stock Journal</title></Head>
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
        <NavPill active="All Trades" isAdmin={isAdmin} />
        <div style={{ display:'flex', gap:'8px', alignItems:'center' }}>
          <button onClick={signOut} className="btn btn-ghost" style={{ padding:'6px 10px', fontSize:'11px' }}>Sign Out</button>
        </div>
      </header>

      <main style={{ maxWidth:'1500px', margin:'0 auto', padding:'80px 16px 40px' }}>

        {/* ── Page title ── */}
        <div style={{ marginBottom:'24px' }}>
          <h1 style={{ fontFamily:'Bookman Old Style, serif', fontSize:'22px', fontWeight:800, color:'var(--text)', margin:0 }}>
            All Trades
          </h1>
          <p style={{ color:'var(--muted)', fontSize:'12px', marginTop:'4px', fontFamily:'DM Mono, monospace' }}>
            Combined view — all accounts + all subscribers
          </p>
        </div>

        {loading ? (
          <div style={{ color:'var(--muted)', padding:'60px', textAlign:'center', fontFamily:'DM Mono, monospace' }}>Loading all trades...</div>
        ) : (
          <>
            {/* ── Stat tiles ── */}
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))', gap:'12px', marginBottom:'28px' }}>
              <StatTile
                label="Unrealised P&L"
                adminVal={`${pnlSign(adminStats.unr)}Rs${toINRd(Math.abs(adminStats.unr))}`}
                subVal={`${pnlSign(subStats.unr)}Rs${toINRd(Math.abs(subStats.unr))}`}
                adminColor={pnlColor(adminStats.unr)}
                subColor={subStats.unr >= 0 ? 'var(--bull)' : 'var(--bear)'}
              />
              <StatTile
                label="Realised P&L"
                adminVal={`${pnlSign(adminStats.rel)}Rs${toINRd(Math.abs(adminStats.rel))}`}
                subVal={`${pnlSign(subStats.rel)}Rs${toINRd(Math.abs(subStats.rel))}`}
                adminColor={pnlColor(adminStats.rel)}
                subColor={subStats.rel >= 0 ? 'var(--bull)' : 'var(--bear)'}
              />
              <StatTile
                label="Open Positions"
                adminVal={adminStats.open}
                subVal={subStats.open}
                adminColor="var(--text)"
                subColor="var(--gold)"
              />
              <StatTile
                label="Closed Trades"
                adminVal={adminStats.closed}
                subVal={subStats.closed}
                adminColor="var(--text)"
                subColor="var(--gold)"
              />
            </div>

            {/* ── Table header row with filter ── */}
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'12px' }}>
              <div style={{ fontSize:'12px', color:'var(--muted)', fontFamily:'DM Mono, monospace' }}>
                {filtered.length} trades &nbsp;
                <span style={{ fontSize:'10px', background:'rgba(245,158,11,0.1)', color:'var(--gold)', padding:'2px 8px', borderRadius:'4px' }}>
                  ■ gold = subscriber account
                </span>
              </div>
              <div style={{ display:'flex', gap:'6px' }}>
                {['ALL','OPEN','CLOSED'].map(f => (
                  <button key={f} onClick={() => setStatusFilter(f)} style={{
                    padding:'5px 14px', borderRadius:'4px', cursor:'pointer', fontSize:'10px',
                    fontFamily:'DM Mono, monospace', fontWeight:600,
                    border:`1px solid ${statusFilter===f?'var(--accent)':'var(--border)'}`,
                    background: statusFilter===f ? 'var(--accent-dim)' : 'transparent',
                    color: statusFilter===f ? 'var(--accent)' : 'var(--muted)',
                  }}>
                    {f} ({f==='ALL'?allRows.length:allRows.filter(r=>r.trade.status===f).length})
                  </button>
                ))}
              </div>
            </div>

            {/* ── Trade table ── */}
            <div style={{ overflowX:'auto', border:'1px solid var(--border)', borderRadius:'8px' }}>
              <table className="trade-table" style={{ width:'100%' }}>
                <thead>
                  <tr>
                    <th>Account</th>
                    <th>Ticker</th>
                    <th>Direction</th>
                    <th>Entry Date</th>
                    <th className="right">Entry Rs</th>
                    <th className="right">CMP</th>
                    <th className="right">Exit Rs</th>
                    <th className="right">Qty</th>
                    <th className="right">Curr Qty</th>
                    <th className="right">MTF Interest</th>
                    <th className="right">Unrealised P&L</th>
                    <th className="right">Realised P&L</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr><td colSpan={12} style={{ textAlign:'center', padding:'40px', color:'var(--muted)' }}>No trades found.</td></tr>
                  ) : filtered.map(({ trade, execMap, isSub, subName }) => {
                    const r = calcRow(trade, execMap)
                    const accountLabel = isSub
                      ? `${subName} / ${trade.account || '—'}`
                      : (trade.account || '—')
                    return (
                      <tr key={`${isSub?'sub':'own'}-${trade.id}`} style={{ borderLeft: isSub ? '3px solid var(--gold)' : '3px solid transparent' }}>
                        <td>
                          <div style={{ fontFamily:'DM Mono, monospace', fontWeight:700, fontSize:'11px', color: isSub ? 'var(--gold)' : 'var(--text)' }}>
                            {accountLabel}
                          </div>
                          {isSub && <div style={{ fontSize:'9px', color:'var(--gold)', opacity:0.7, marginTop:'1px' }}>SUBSCRIBER</div>}
                        </td>
                        <td><span className="ticker-badge">{trade.ticker}</span></td>
                        <td><span className={`badge badge-${trade.direction?.toLowerCase()}`}>{trade.direction}</span></td>
                        <td className="muted">{trade.entry_date?.slice(0,10)}</td>
                        <td className="right">Rs{toINRd(r.entryPrice)}</td>
                        <td className="right">
                          {r.cmp
                            ? <div>
                                <div style={{ fontWeight:600 }}>Rs{toINRd(r.cmp)}</div>
                                <div style={{ fontSize:'10px', color: r.lp?.change>=0?'var(--bull)':'var(--bear)' }}>
                                  {r.lp?.change>=0?'+':''}{r.lp?.changePercent?.toFixed(2)}%
                                </div>
                              </div>
                            : <span className="neutral">—</span>}
                        </td>
                        <td className="right">
                          {r.exitPrice ? `Rs${toINRd(r.exitPrice)}` : <span className="neutral">—</span>}
                        </td>
                        <td className="right">{toINR(r.originalQty)}</td>
                        <td className="right">
                          <span style={{ fontWeight:700, color: r.currentQty===0?'var(--bear)':r.currentQty<r.originalQty?'var(--gold)':'var(--text)' }}>
                            {toINR(r.currentQty)}
                          </span>
                        </td>
                        <td className="right">
                          {r.mtfInt > 0
                            ? <span style={{ color:'var(--gold)' }}>Rs{toINRd(r.mtfInt)}</span>
                            : <span className="neutral">—</span>}
                        </td>
                        <td className="right">
                          {r.unrealisedPnL !== null
                            ? <span style={{ fontWeight:600, color:pnlColor(r.unrealisedPnL) }}>
                                {pnlSign(r.unrealisedPnL)}Rs{toINRd(Math.abs(r.unrealisedPnL))}
                              </span>
                            : <span className="neutral">—</span>}
                        </td>
                        <td className="right">
                          {r.realisedPnL !== 0 || trade.status==='CLOSED'
                            ? <span style={{ fontWeight:600, color:pnlColor(r.realisedPnL) }}>
                                {pnlSign(r.realisedPnL)}Rs{toINRd(Math.abs(r.realisedPnL))}
                              </span>
                            : <span className="neutral">—</span>}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </main>
    </>
  )
}
