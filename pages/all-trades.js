import React, { useState, useEffect, useCallback } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'
import { supabase } from '../lib/supabase'
import { differenceInDays } from 'date-fns'
import Sidebar from '../components/Sidebar'

function triggerCSVDownload(csvContent, filename) {
  if (typeof window === 'undefined') return
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = window.URL.createObjectURL(blob)
  const link = window.document.createElement('a')
  link.setAttribute('href', url)
  link.setAttribute('download', filename)
  link.style.display = 'none'
  window.document.body.appendChild(link)
  link.click()
  window.document.body.removeChild(link)
  window.URL.revokeObjectURL(url)
}

const ADMIN_EMAIL = 'gogoaheadgo@gmail.com'
const toINR = n => Number(n||0).toLocaleString('en-IN', { maximumFractionDigits:0 })
const toINRd = n => Number(n||0).toLocaleString('en-IN', { minimumFractionDigits:2, maximumFractionDigits:2 })

export default function AllTradesPage() {
  const router = useRouter()
  const [session, setSession] = useState(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(false)
  const [ownTrades, setOwnTrades] = useState([])
  const [ownExecs, setOwnExecs] = useState({})
  const [subGroups, setSubGroups] = useState([])
  const [livePrices, setLivePrices] = useState({})
  const [statusFilter, setStatusFilter] = useState('ALL')

  const getToken = async () => (await supabase.auth.getSession()).data.session?.access_token
  const fetchPrice = async (ticker) => {
    try { const r = await fetch(`/api/stock/${ticker}`); const d = await r.json(); if (d.price) setLivePrices(prev => ({...prev,[ticker]:d})) } catch {}
  }

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

  const [expandedTicker, setExpandedTicker] = useState(null)
  const [sortCol, setSortCol] = useState(null)
  const [sortDir, setSortDir] = useState('asc')
  const doSort = (col) => { if(sortCol===col) setSortDir(d=>d==='asc'?'desc':'asc'); else { setSortCol(col); setSortDir('asc') } }
  const sortIcon = (col) => sortCol===col ? (sortDir==='asc'?' ↑':' ↓') : ' ↕'
  const applySort = (list) => {
    if (!sortCol) return list
    return [...list].sort((a,b) => {
      let av=a[sortCol]??'', bv=b[sortCol]??''
      if (typeof av==='string') av=av.toLowerCase(), bv=bv.toLowerCase()
      return sortDir==='asc'?(av>bv?1:-1):(av<bv?1:-1)
    })
  }
  const downloadCSV = () => {
    const list = statusFilter==='ALL' ? allRows : allRows.filter(r=>r.trade.status===statusFilter)
    const h=['Ticker','Account','Direction','Entry Date','Entry Price','Exit Price','Qty','Curr Qty','Investment','Actual Investment','Unrealised P&L','Realised P&L','MTF Interest','Status','Type']
    const rows=list.map(({trade,isSub,execMap:rowExecMap}) => {
      const exs = rowExecMap?.[trade.id] || []
      const sold = exs.reduce((s,e)=>s+Number(e.quantity),0)
      const orig = Number(trade.quantity)||0
      const curr = Math.max(0,orig-sold)
      const entry = Number(trade.entry_price)||0
      const lp = livePrices[trade.ticker]?.price
      const unr = trade.status==='OPEN' && lp && curr>0?(trade.direction==='LONG'?(lp-entry)*curr:(entry-lp)*curr):''
      const rel = exs.length>0?exs.reduce((s,e)=>s+(Number(e.price)-entry)*Number(e.quantity),0):(Number(trade.realized_gains)||0)
      const investment = Number(trade.invested_capital) || (entry * orig)
      const actualInv  = Number(trade.actual_investment) || 0
      const mtfBase    = actualInv > 0 ? investment - actualInv : 0
      let mtf = ''
      if (mtfBase > 0 && trade.mtf_interest_rate && trade.entry_date) {
        const soldMtf = exs.reduce((s,e) => {
          const days = Math.max(1, Math.floor((new Date(e.date) - new Date(trade.entry_date)) / 86400000))
          return s + mtfBase * (Number(e.quantity)/orig) * trade.mtf_interest_rate * days / 36500
        }, 0)
        const remDays = Math.max(1, Math.floor((new Date() - new Date(trade.entry_date)) / 86400000))
        const remMtf  = trade.status === 'OPEN' ? mtfBase * (curr/orig) * trade.mtf_interest_rate * remDays / 36500 : 0
        mtf = (soldMtf + remMtf).toFixed(2)
      }
      return [trade.ticker,trade.account,trade.direction,trade.entry_date,entry,trade.exit_price||'',orig,curr,investment?investment.toFixed(2):'',actualInv?actualInv.toFixed(2):'',unr!==''?unr.toFixed(2):'',rel.toFixed(2),mtf,trade.status,isSub?'Subscriber':'Admin']
    })
    const csv=[h,...rows].map(r=>r.join(',')).join('\n')
    triggerCSVDownload(csv, 'all-trades.csv')
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
  const filteredRaw = allRows.filter(r => statusFilter==='ALL' || r.trade.status===statusFilter)
  const filtered = sortCol
    ? [...filteredRaw].sort((a, b) => {
        let av = a.trade[sortCol] ?? '', bv = b.trade[sortCol] ?? ''
        if (typeof av === 'string') { av = av.toLowerCase(); bv = bv.toLowerCase() }
        return sortDir === 'asc' ? (av > bv ? 1 : -1) : (av < bv ? 1 : -1)
      })
    : filteredRaw

  const pnlColor = n => n >= 0 ? 'var(--bull)' : 'var(--bear)'
  const pnlSign  = n => n >= 0 ? '+' : '−'

  // ── Ticker summary groups ──
  const tickerGroupMap = {}
  allRows.forEach(({ trade, execMap, isSub, subName }) => {
    const tk = trade.ticker
    if (!tickerGroupMap[tk]) tickerGroupMap[tk] = []
    tickerGroupMap[tk].push({ trade, execMap, isSub, subName })
  })
  const tickerSummary = Object.entries(tickerGroupMap).map(([ticker, rows]) => {
    const totalQty = rows.reduce((s, { trade }) => s + Number(trade.quantity || 0), 0)
    const currQty = rows.reduce((s, { trade, execMap }) => {
      const sold = (execMap[trade.id] || []).reduce((es, e) => es + Number(e.quantity || 0), 0)
      return s + Math.max(0, Number(trade.quantity || 0) - sold)
    }, 0)
    const cmp = livePrices[ticker]?.price || null
    const totalInvestment = rows.reduce((s, { trade }) =>
      s + (Number(trade.invested_capital) || (Number(trade.entry_price) * Number(trade.quantity)) || 0), 0)
    const actualInvestment = rows.reduce((s, { trade }) => s + (Number(trade.actual_investment) || 0), 0)
    const unrealised = rows.filter(({ trade }) => trade.status === 'OPEN').reduce((s, { trade, execMap }) => {
      if (!cmp) return s
      const sold = (execMap[trade.id] || []).reduce((es, e) => es + Number(e.quantity || 0), 0)
      const qty = Math.max(0, Number(trade.quantity) - sold)
      return s + (trade.direction === 'SHORT' ? (Number(trade.entry_price) - cmp) * qty : (cmp - Number(trade.entry_price)) * qty)
    }, 0)
    const realised = rows.reduce((s, { trade, execMap }) => {
      const exs = execMap[trade.id] || []
      return s + exs.reduce((es, e) => es + (Number(e.price) - Number(trade.entry_price)) * Number(e.quantity), 0)
    }, 0)
    return { ticker, totalQty, currQty, cmp, totalInvestment, actualInvestment, unrealised, realised, rows }
  }).sort((a, b) => a.ticker.localeCompare(b.ticker))

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

      <Sidebar active="All Trades" isAdmin={isAdmin} user={session?.user} onSignOut={signOut} />

      <main className="sidebar-offset" style={{ padding:'28px 32px 40px' }}>

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
                adminVal={`${pnlSign(adminStats.unr)}${toINRd(Math.abs(adminStats.unr))}`}
                subVal={`${pnlSign(subStats.unr)}${toINRd(Math.abs(subStats.unr))}`}
                adminColor={pnlColor(adminStats.unr)}
                subColor={subStats.unr >= 0 ? 'var(--bull)' : 'var(--bear)'}
              />
              <StatTile
                label="Realised P&L"
                adminVal={`${pnlSign(adminStats.rel)}${toINRd(Math.abs(adminStats.rel))}`}
                subVal={`${pnlSign(subStats.rel)}${toINRd(Math.abs(subStats.rel))}`}
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

            {/* ── Ticker Summary ── */}
            <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'8px', padding:'20px', marginBottom:'20px' }}>
              <div style={{ marginBottom:'14px' }}>
                <div style={{ fontFamily:'Bookman Old Style, serif', fontWeight:700, fontSize:'14px', color:'var(--text)' }}>Ticker Summary</div>
                <div style={{ fontSize:'11px', color:'var(--muted)', fontFamily:'DM Mono, monospace', marginTop:'2px' }}>Click any row to see account-wise breakdown</div>
              </div>
              <table className="data-table">
                <colgroup>
                  <col style={{ width:'12%' }} />
                  <col style={{ width:'7%' }} />
                  <col style={{ width:'7%' }} />
                  <col style={{ width:'9%' }} />
                  <col style={{ width:'13%' }} />
                  <col style={{ width:'13%' }} />
                  <col style={{ width:'14%' }} />
                  <col style={{ width:'14%' }} />
                </colgroup>
                <thead>
                  <tr>
                    <th>Ticker</th>
                    <th className="r">Total Qty</th>
                    <th className="r">Curr Qty</th>
                    <th className="r">CMP</th>
                    <th className="r">Total Inv.</th>
                    <th className="r">Actual Inv.</th>
                    <th className="r">Unreal. P&L</th>
                    <th className="r">Real. P&L</th>
                  </tr>
                </thead>
                <tbody>
                  {tickerSummary.map(tg => (
                    <React.Fragment key={tg.ticker}>
                      <tr onClick={() => setExpandedTicker(expandedTicker === tg.ticker ? null : tg.ticker)}
                        style={{ cursor:'pointer', borderLeft:`3px solid ${expandedTicker===tg.ticker?'var(--accent)':'transparent'}`, background: expandedTicker===tg.ticker?'rgba(14,165,233,0.04)':'transparent' }}>
                        <td>
                          <div className="tk-cell">
                            <span style={{ fontSize:'11px', color:'var(--muted)', marginRight:'4px' }}>{expandedTicker===tg.ticker?'▼':'▶'}</span>
                            <span className="tk-name">{tg.ticker}</span>
                          </div>
                        </td>
                        <td className="num">{toINR(tg.totalQty)}</td>
                        <td className="num" style={{ fontWeight:700, color: tg.currQty===0?'var(--bear)':tg.currQty<tg.totalQty?'var(--gold)':'var(--text)' }}>{toINR(tg.currQty)}</td>
                        <td className="num">{tg.cmp ? `Rs.${toINRd(tg.cmp)}` : <span className="neutral">—</span>}</td>
                        <td className="num">Rs.{toINRd(tg.totalInvestment)}</td>
                        <td className="num">{tg.actualInvestment > 0 ? `Rs.${toINRd(tg.actualInvestment)}` : <span className="neutral">—</span>}</td>
                        <td className="num">
                          {tg.cmp
                            ? <span className={tg.unrealised>=0?'pnl-pos':'pnl-neg'}>{pnlSign(tg.unrealised)}Rs.{toINRd(Math.abs(tg.unrealised))}</span>
                            : <span className="neutral">—</span>}
                        </td>
                        <td className="num">
                          {tg.realised !== 0
                            ? <span className={tg.realised>=0?'pnl-pos':'pnl-neg'}>{pnlSign(tg.realised)}Rs.{toINRd(Math.abs(tg.realised))}</span>
                            : <span className="neutral">—</span>}
                        </td>
                      </tr>
                      {expandedTicker === tg.ticker && tg.rows.map(({ trade, execMap, isSub, subName }, idx) => {
                        const r = calcRow(trade, execMap)
                        const acctLabel = isSub ? `${subName} / ${trade.account || '—'}` : (trade.account || '—')
                        return (
                          <tr key={`${tg.ticker}-sub-${idx}`} style={{ background:'var(--surface)', borderLeft:'3px solid var(--accent)' }}>
                            <td style={{ paddingLeft:'20px' }}>
                              <div style={{ fontSize:'11px', fontFamily:'DM Mono, monospace', fontWeight:600, color: isSub?'var(--gold)':'var(--accent)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{acctLabel}</div>
                              <div style={{ fontSize:'9px', color:'var(--muted)', fontFamily:'DM Mono, monospace' }}>Entry: Rs.{toINRd(r.entryPrice)} · {trade.entry_date?.slice(0,10)}</div>
                            </td>
                            <td className="num">{toINR(r.originalQty)}</td>
                            <td className="num" style={{ fontWeight:700, color: r.currentQty===0?'var(--bear)':r.currentQty<r.originalQty?'var(--gold)':'var(--text)' }}>{toINR(r.currentQty)}</td>
                            <td className="num">{r.cmp ? `Rs.${toINRd(r.cmp)}` : <span className="neutral">—</span>}</td>
                            <td className="num">Rs.{toINRd(r.investment)}</td>
                            <td className="num">{r.actualInv > 0 ? `Rs.${toINRd(r.actualInv)}` : <span className="neutral">—</span>}</td>
                            <td className="num">
                              {r.unrealisedPnL !== null
                                ? <span className={r.unrealisedPnL>=0?'pnl-pos':'pnl-neg'}>{pnlSign(r.unrealisedPnL)}Rs.{toINRd(Math.abs(r.unrealisedPnL))}</span>
                                : <span className="neutral">—</span>}
                            </td>
                            <td className="num">
                              {r.realisedPnL !== 0
                                ? <span className={r.realisedPnL>=0?'pnl-pos':'pnl-neg'}>{pnlSign(r.realisedPnL)}Rs.{toINRd(Math.abs(r.realisedPnL))}</span>
                                : <span className="neutral">—</span>}
                            </td>
                          </tr>
                        )
                      })}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>

            {/* ── All Trades — Detailed View ── */}
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'12px' }}>
              <div>
                <div style={{ fontFamily:'Bookman Old Style, serif', fontWeight:700, fontSize:'14px', color:'var(--text)' }}>All Trades — Detailed View</div>
                <div style={{ fontSize:'11px', color:'var(--muted)', fontFamily:'DM Mono, monospace', marginTop:'2px' }}>
                  {filtered.length} trades &nbsp;
                  <span style={{ fontSize:'10px', background:'rgba(245,158,11,0.1)', color:'var(--gold)', padding:'2px 8px', borderRadius:'4px' }}>
                    ■ gold = subscriber account
                  </span>
                </div>
              </div>
              <div style={{ display:'flex', gap:'6px', alignItems:'center' }}>
                <button onClick={downloadCSV} style={{ padding:'5px 12px', background:'var(--surface)', border:'1px solid var(--border)', color:'var(--muted)', borderRadius:'4px', cursor:'pointer', fontSize:'10px', fontFamily:'DM Mono, monospace' }}>⬇ CSV</button>
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

            {/* ── Trade table — responsive, no horizontal scroll ── */}
            <div style={{ border:'1px solid var(--border)', borderRadius:'8px', overflow:'hidden' }}>
              <table className="data-table">
                <colgroup>
                  <col style={{ width:'13%' }} />
                  <col style={{ width:'11%' }} />
                  <col style={{ width:'9%' }} />
                  <col style={{ width:'8%' }} />
                  <col style={{ width:'9%' }} />
                  <col style={{ width:'8%' }} />
                  <col style={{ width:'7%' }} />
                  <col style={{ width:'7%' }} />
                  <col style={{ width:'14%' }} />
                  <col style={{ width:'14%' }} />
                </colgroup>
                <thead>
                  <tr>
                    <th className="sortable" onClick={() => doSort('account')}>Account{sortIcon('account')}</th>
                    <th className="sortable" onClick={() => doSort('ticker')}>Ticker/Dir{sortIcon('ticker')}</th>
                    <th className="sortable" onClick={() => doSort('entry_date')}>Entry Date{sortIcon('entry_date')}</th>
                    <th className="sortable r" onClick={() => doSort('entry_price')}>Entry Rs.{sortIcon('entry_price')}</th>
                    <th className="r">CMP</th>
                    <th className="sortable r" onClick={() => doSort('exit_price')}>Exit Rs.{sortIcon('exit_price')}</th>
                    <th className="r">Qty / Curr</th>
                    <th className="r">MTF Int</th>
                    <th className="r">Unreal. P&L</th>
                    <th className="r">Real. P&L</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr><td colSpan={10} style={{ textAlign:'center', padding:'40px', color:'var(--muted)' }}>No trades found.</td></tr>
                  ) : filtered.map(({ trade, execMap, isSub, subName }) => {
                    const r = calcRow(trade, execMap)
                    const accountLabel = isSub
                      ? `${subName} / ${trade.account || '—'}`
                      : (trade.account || '—')
                    return (
                      <tr key={`${isSub?'sub':'own'}-${trade.id}`} style={{ borderLeft: isSub ? '3px solid var(--gold)' : '3px solid transparent' }}>
                        <td>
                          <div style={{ fontFamily:'DM Mono, monospace', fontWeight:600, fontSize:'11px', color: isSub ? 'var(--gold)' : 'var(--text)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                            {accountLabel}
                          </div>
                        </td>
                        <td>
                          <div className="tk-cell">
                            <span className="tk-name">{trade.ticker}</span>
                            <div className="tk-badges">
                              <span className={trade.direction==='LONG'?'dir-long':'dir-short'}>{trade.direction}</span>
                              <span className={trade.status==='OPEN'?'st-open':'st-closed'}>{trade.status}</span>
                            </div>
                          </div>
                        </td>
                        <td style={{ fontSize:'11px', color:'var(--muted)', fontFamily:'DM Mono, monospace' }}>{trade.entry_date?.slice(0,10)}</td>
                        <td className="num">Rs.{toINRd(r.entryPrice)}</td>
                        <td className="num">
                          {r.cmp
                            ? <div className="sc">
                                <span className="sc1" style={{ fontWeight:600 }}>Rs.{toINRd(r.cmp)}</span>
                                <span className="sc2" style={{ color: r.lp?.change>=0?'var(--bull)':'var(--bear)' }}>
                                  {r.lp?.change>=0?'+':''}{r.lp?.changePercent?.toFixed(2)}%
                                </span>
                              </div>
                            : <span className="neutral">—</span>}
                        </td>
                        <td className="num">{r.exitPrice ? `Rs.${toINRd(r.exitPrice)}` : <span className="neutral">—</span>}</td>
                        <td className="num">
                          <div className="sc">
                            <span className="sc1">{toINR(r.originalQty)}</span>
                            <span className="sc2" style={{ color: r.currentQty===0?'var(--bear)':r.currentQty<r.originalQty?'var(--gold)':'var(--muted)' }}>{toINR(r.currentQty)} cur</span>
                          </div>
                        </td>
                        <td className="num">
                          {r.mtfInt > 0
                            ? <span className="mtf-val">Rs.{toINRd(r.mtfInt)}</span>
                            : <span className="neutral">—</span>}
                        </td>
                        <td className="num">
                          {r.unrealisedPnL !== null
                            ? <span className={r.unrealisedPnL>=0?'pnl-pos':'pnl-neg'}>{pnlSign(r.unrealisedPnL)}Rs.{toINRd(Math.abs(r.unrealisedPnL))}</span>
                            : <span className="neutral">—</span>}
                        </td>
                        <td className="num">
                          {r.realisedPnL !== 0 || trade.status==='CLOSED'
                            ? <span className={r.realisedPnL>=0?'pnl-pos':'pnl-neg'}>{pnlSign(r.realisedPnL)}Rs.{toINRd(Math.abs(r.realisedPnL))}</span>
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
