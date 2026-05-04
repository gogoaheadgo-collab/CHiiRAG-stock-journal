import React, { useState, useEffect, useCallback, useMemo } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'
import { supabase } from '../lib/supabase'
import { differenceInDays } from 'date-fns'
import Sidebar from '../components/Sidebar'
import { useTableFilter, FilterDropdown } from '../components/TableFilter'

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
  // Ticker summary sort state
  const [tickerStatusFilter, setTickerStatusFilter] = useState('ALL')
  const [tkSortKey, setTkSortKey] = useState(null)
  const [tkSortDir, setTkSortDir] = useState('asc')
  const [tkHiddenTickers, setTkHiddenTickers] = useState(new Set())
  const [tkFilterOpen, setTkFilterOpen] = useState(false)
  const [tkFilterPos, setTkFilterPos] = useState({ top:0, left:0 })
  const downloadCSV = () => {
    const list = tf.statusFilter==='ALL' ? allRows : allRows.filter(r=>r.trade.status===tf.statusFilter)
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

  const pnlColor = n => n >= 0 ? 'var(--bull)' : 'var(--bear)'
  const pnlSign  = n => n >= 0 ? '+' : '−'

  // ── Detailed table columns ──
  const detailedColumns = useMemo(() => [
    { key:'account', label:'Account', getValue: r => r.isSub ? `${r.subName} / ${r.trade.account||''}` : (r.trade.account||''), filterable:true, sortable:true },
    { key:'ticker',  label:'Ticker',  getValue: r => r.trade.ticker, filterable:true, sortable:true },
    { key:'direction', label:'Dir',   getValue: r => r.trade.direction, filterable:true, sortable:true },
    { key:'entry_date', label:'Entry Date', getValue: r => r.trade.entry_date, sortable:true },
    { key:'entry_price', label:'Entry Rs.', getSortValue: r => Number(r.trade.entry_price), sortable:true },
    { key:'exit_price',  label:'Exit Rs.',  getSortValue: r => Number(r.trade.exit_price)||0, sortable:true },
    { key:'qty',     label:'Qty',    getSortValue: r => Number(r.trade.quantity), sortable:true },
    { key:'mtf_int', label:'MTF Int',getSortValue: r => { const rc = calcRow(r.trade, r.execMap); return rc.mtfInt||0 }, sortable:true },
    { key:'unrealised', label:'Unreal. P&L', getSortValue: r => { const rc = calcRow(r.trade, r.execMap); return rc.unrealisedPnL??-Infinity }, sortable:true },
    { key:'realised',   label:'Real. P&L',   getSortValue: r => { const rc = calcRow(r.trade, r.execMap); return rc.realisedPnL??0 }, sortable:true },
  ], [calcRow])  // eslint-disable-line

  const tf = useTableFilter(allRows, detailedColumns, {
    hasStatusFilter: true,
    statusField: r => r.trade.status,
  })

  // ── Ticker summary groups ──
  const tickerGroupMap = {}
  allRows.forEach(({ trade, execMap, isSub, subName }) => {
    const tk = trade.ticker
    if (!tickerGroupMap[tk]) tickerGroupMap[tk] = []
    tickerGroupMap[tk].push({ trade, execMap, isSub, subName })
  })
  const tickerSummaryRaw = Object.entries(tickerGroupMap).map(([ticker, rows]) => {
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

  const tickerSummary = useMemo(() => {
    let result = tickerSummaryRaw
    // Apply ticker-specific status filter (independent from detailed table filter)
    if (tickerStatusFilter !== 'ALL') {
      result = result.filter(tg => {
        if (tickerStatusFilter === 'OPEN') return tg.rows.some(r => r.trade.status === 'OPEN')
        return tg.rows.some(r => r.trade.status === 'CLOSED')
      })
    }
    // Apply ticker column filter
    if (tkHiddenTickers.size > 0) result = result.filter(tg => !tkHiddenTickers.has(tg.ticker))
    // Apply sort
    if (tkSortKey) {
      result = [...result].sort((a, b) => {
        const av = a[tkSortKey] ?? -Infinity
        const bv = b[tkSortKey] ?? -Infinity
        if (typeof av === 'string') return tkSortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av)
        return tkSortDir === 'asc' ? av - bv : bv - av
      })
    }
    return result
  }, [tickerSummaryRaw, tickerStatusFilter, tkHiddenTickers, tkSortKey, tkSortDir])  // eslint-disable-line

  const tkSort = (key) => {
    if (tkSortKey === key) { if (tkSortDir === 'asc') setTkSortDir('desc'); else { setTkSortKey(null) } }
    else { setTkSortKey(key); setTkSortDir('asc') }
  }
  const tkArrow = (key) => tkSortKey === key
    ? <span className={`sort-arrow active`}>{tkSortDir === 'asc' ? '↑' : '↓'}</span>
    : <span className="sort-arrow">↕</span>

  const allTickerValues = tickerSummaryRaw.map(tg => tg.ticker)

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
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'14px' }}>
                <div>
                  <div style={{ fontFamily:'Bookman Old Style, serif', fontWeight:700, fontSize:'14px', color:'var(--text)' }}>Ticker Summary</div>
                  <div style={{ fontSize:'11px', color:'var(--muted)', fontFamily:'DM Mono, monospace', marginTop:'2px' }}>Click any row to see account-wise breakdown</div>
                </div>
                <div style={{ display:'flex', gap:'4px', background:'var(--bg)', borderRadius:'8px', padding:'3px', border:'1px solid var(--border)' }}>
                  {['ALL', 'OPEN', 'CLOSED'].map(status => (
                    <button key={status} onClick={() => setTickerStatusFilter(status)} style={{ padding:'5px 14px', border:'none', borderRadius:'6px', fontSize:'11px', fontWeight:600, cursor:'pointer', fontFamily:'DM Mono, monospace', transition:'all 0.15s', background: tickerStatusFilter === status ? 'var(--accent)' : 'transparent', color: tickerStatusFilter === status ? '#fff' : 'var(--muted)' }}>
                      {status === 'ALL' ? 'All' : status === 'OPEN' ? 'Open' : 'Closed'}
                    </button>
                  ))}
                </div>
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
                    <th style={{ position:'relative' }}>
                      <div className="col-header">
                        <span style={{ cursor:'pointer' }} onClick={() => tkSort('ticker')}>Ticker{tkArrow('ticker')}</span>
                        <span className={`filter-icon ${tkHiddenTickers.size > 0 ? 'has-filter' : ''}`}
                          onClick={e => { e.stopPropagation(); const r = e.currentTarget.getBoundingClientRect(); setTkFilterPos({ top:r.bottom+4, left:Math.min(r.left, window.innerWidth-228) }); setTkFilterOpen(o=>!o) }}>▼</span>
                      </div>
                      {tkFilterOpen && (
                        <FilterDropdown
                          position={tkFilterPos}
                          uniqueValues={allTickerValues}
                          hiddenValues={tkHiddenTickers}
                          onToggle={val => { const s = new Set(tkHiddenTickers); s.has(val)?s.delete(val):s.add(val); setTkHiddenTickers(s) }}
                          onSelectAll={() => setTkHiddenTickers(new Set())}
                          onDeselectAll={() => setTkHiddenTickers(new Set(allTickerValues))}
                          onClose={() => setTkFilterOpen(false)}
                        />
                      )}
                    </th>
                    <th className="r" style={{ cursor:'pointer' }} onClick={() => tkSort('totalQty')}><span className="col-header" style={{ justifyContent:'flex-end' }}>Total Qty{tkArrow('totalQty')}</span></th>
                    <th className="r" style={{ cursor:'pointer' }} onClick={() => tkSort('currQty')}><span className="col-header" style={{ justifyContent:'flex-end' }}>Curr Qty{tkArrow('currQty')}</span></th>
                    <th className="r" style={{ cursor:'pointer' }} onClick={() => tkSort('cmp')}><span className="col-header" style={{ justifyContent:'flex-end' }}>CMP{tkArrow('cmp')}</span></th>
                    <th className="r" style={{ cursor:'pointer' }} onClick={() => tkSort('totalInvestment')}><span className="col-header" style={{ justifyContent:'flex-end' }}>Total Inv.{tkArrow('totalInvestment')}</span></th>
                    <th className="r" style={{ cursor:'pointer' }} onClick={() => tkSort('actualInvestment')}><span className="col-header" style={{ justifyContent:'flex-end' }}>Actual Inv.{tkArrow('actualInvestment')}</span></th>
                    <th className="r" style={{ cursor:'pointer' }} onClick={() => tkSort('unrealised')}><span className="col-header" style={{ justifyContent:'flex-end' }}>Unreal. P&L{tkArrow('unrealised')}</span></th>
                    <th className="r" style={{ cursor:'pointer' }} onClick={() => tkSort('realised')}><span className="col-header" style={{ justifyContent:'flex-end' }}>Real. P&L{tkArrow('realised')}</span></th>
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
                      {expandedTicker === tg.ticker && tg.rows.filter(r => tickerStatusFilter === 'ALL' || r.trade.status === tickerStatusFilter).map(({ trade, execMap, isSub, subName }, idx) => {
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
                  {tf.filteredData.length} trades &nbsp;
                  <span style={{ fontSize:'10px', background:'rgba(245,158,11,0.1)', color:'var(--gold)', padding:'2px 8px', borderRadius:'4px' }}>
                    ■ gold = subscriber account
                  </span>
                </div>
              </div>
              <div style={{ display:'flex', gap:'6px', alignItems:'center', flexWrap:'wrap' }}>
                <button onClick={downloadCSV} style={{ padding:'5px 12px', background:'var(--surface)', border:'1px solid var(--border)', color:'var(--muted)', borderRadius:'4px', cursor:'pointer', fontSize:'10px', fontFamily:'DM Mono, monospace' }}>⬇ CSV</button>
                <div className="status-filter-bar" style={{ marginBottom:0 }}>
                  {['ALL','OPEN','CLOSED'].map(f => (
                    <button key={f} className={`status-btn ${tf.statusFilter===f?'active':''}`}
                      onClick={() => tf.setStatusFilter(f)}>
                      {f==='ALL'?'All':f} ({f==='ALL'?allRows.length:allRows.filter(r=>r.trade.status===f).length})
                    </button>
                  ))}
                </div>
                {tf.activeFilterCount > 0 && (
                  <button className="clear-all-btn" onClick={tf.clearAllFilters}>✕ Clear filters</button>
                )}
              </div>
            </div>

            {/* Active filter pills */}
            {tf.activeFilterCount > 0 && (
              <div className="active-filters-bar" style={{ marginBottom:'10px' }}>
                <span className="filter-label">Active:</span>
                {Object.entries(tf.columnFilters).map(([colKey, hidden]) => {
                  if (!hidden || hidden.size === 0) return null
                  const col = detailedColumns.find(c => c.key === colKey)
                  return (
                    <span key={colKey} className="filter-pill">
                      {col?.label}: {hidden.size} hidden
                      <span className="remove-filter" onClick={() => tf.clearColumnFilter(colKey)}>×</span>
                    </span>
                  )
                })}
              </div>
            )}

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
                    <th style={{ position:'relative' }}>
                      <div className="col-header">
                        <span style={{ cursor:'pointer' }} onClick={() => tf.handleSort('account')}>Account<span className={`sort-arrow ${tf.sortConfig?.key==='account'?'active':''}`}>{tf.sortConfig?.key==='account'?(tf.sortConfig.direction==='asc'?'↑':'↓'):'↕'}</span></span>
                        <span className={`filter-icon ${tf.columnFilters['account']?.size>0?'has-filter':''}`} onClick={e => tf.openFilter(e,'account')}>▼</span>
                      </div>
                      {tf.openFilterKey==='account' && <FilterDropdown position={tf.filterDropPos} uniqueValues={tf.getUniqueValues('account')} hiddenValues={tf.columnFilters['account']||new Set()} onToggle={v=>tf.toggleFilterValue('account',v)} onSelectAll={()=>tf.selectAllFilter('account')} onDeselectAll={()=>tf.deselectAllFilter('account',tf.getUniqueValues('account'))} onClose={()=>tf.setOpenFilterKey(null)} />}
                    </th>
                    <th style={{ position:'relative' }}>
                      <div className="col-header">
                        <span style={{ cursor:'pointer' }} onClick={() => tf.handleSort('ticker')}>Ticker/Dir<span className={`sort-arrow ${tf.sortConfig?.key==='ticker'?'active':''}`}>{tf.sortConfig?.key==='ticker'?(tf.sortConfig.direction==='asc'?'↑':'↓'):'↕'}</span></span>
                        <span className={`filter-icon ${tf.columnFilters['ticker']?.size>0?'has-filter':''}`} onClick={e => tf.openFilter(e,'ticker')} title="Filter Ticker">▼</span>
                        <span className={`filter-icon ${tf.columnFilters['direction']?.size>0?'has-filter':''}`} onClick={e => tf.openFilter(e,'direction')} title="Filter Dir" style={{ fontSize:'8px' }}>⇅</span>
                      </div>
                      {tf.openFilterKey==='ticker' && <FilterDropdown position={tf.filterDropPos} uniqueValues={tf.getUniqueValues('ticker')} hiddenValues={tf.columnFilters['ticker']||new Set()} onToggle={v=>tf.toggleFilterValue('ticker',v)} onSelectAll={()=>tf.selectAllFilter('ticker')} onDeselectAll={()=>tf.deselectAllFilter('ticker',tf.getUniqueValues('ticker'))} onClose={()=>tf.setOpenFilterKey(null)} />}
                      {tf.openFilterKey==='direction' && <FilterDropdown position={tf.filterDropPos} uniqueValues={tf.getUniqueValues('direction')} hiddenValues={tf.columnFilters['direction']||new Set()} onToggle={v=>tf.toggleFilterValue('direction',v)} onSelectAll={()=>tf.selectAllFilter('direction')} onDeselectAll={()=>tf.deselectAllFilter('direction',tf.getUniqueValues('direction'))} onClose={()=>tf.setOpenFilterKey(null)} />}
                    </th>
                    <th style={{ cursor:'pointer' }} onClick={() => tf.handleSort('entry_date')}><div className="col-header">Entry Date<span className={`sort-arrow ${tf.sortConfig?.key==='entry_date'?'active':''}`}>{tf.sortConfig?.key==='entry_date'?(tf.sortConfig.direction==='asc'?'↑':'↓'):'↕'}</span></div></th>
                    <th className="r" style={{ cursor:'pointer' }} onClick={() => tf.handleSort('entry_price')}><div className="col-header" style={{ justifyContent:'flex-end' }}>Entry Rs.<span className={`sort-arrow ${tf.sortConfig?.key==='entry_price'?'active':''}`}>{tf.sortConfig?.key==='entry_price'?(tf.sortConfig.direction==='asc'?'↑':'↓'):'↕'}</span></div></th>
                    <th className="r">CMP</th>
                    <th className="r" style={{ cursor:'pointer' }} onClick={() => tf.handleSort('exit_price')}><div className="col-header" style={{ justifyContent:'flex-end' }}>Exit Rs.<span className={`sort-arrow ${tf.sortConfig?.key==='exit_price'?'active':''}`}>{tf.sortConfig?.key==='exit_price'?(tf.sortConfig.direction==='asc'?'↑':'↓'):'↕'}</span></div></th>
                    <th className="r" style={{ cursor:'pointer' }} onClick={() => tf.handleSort('qty')}><div className="col-header" style={{ justifyContent:'flex-end' }}>Qty / Curr<span className={`sort-arrow ${tf.sortConfig?.key==='qty'?'active':''}`}>{tf.sortConfig?.key==='qty'?(tf.sortConfig.direction==='asc'?'↑':'↓'):'↕'}</span></div></th>
                    <th className="r" style={{ cursor:'pointer' }} onClick={() => tf.handleSort('mtf_int')}><div className="col-header" style={{ justifyContent:'flex-end' }}>MTF Int<span className={`sort-arrow ${tf.sortConfig?.key==='mtf_int'?'active':''}`}>{tf.sortConfig?.key==='mtf_int'?(tf.sortConfig.direction==='asc'?'↑':'↓'):'↕'}</span></div></th>
                    <th className="r" style={{ cursor:'pointer' }} onClick={() => tf.handleSort('unrealised')}><div className="col-header" style={{ justifyContent:'flex-end' }}>Unreal. P&L<span className={`sort-arrow ${tf.sortConfig?.key==='unrealised'?'active':''}`}>{tf.sortConfig?.key==='unrealised'?(tf.sortConfig.direction==='asc'?'↑':'↓'):'↕'}</span></div></th>
                    <th className="r" style={{ cursor:'pointer' }} onClick={() => tf.handleSort('realised')}><div className="col-header" style={{ justifyContent:'flex-end' }}>Real. P&L<span className={`sort-arrow ${tf.sortConfig?.key==='realised'?'active':''}`}>{tf.sortConfig?.key==='realised'?(tf.sortConfig.direction==='asc'?'↑':'↓'):'↕'}</span></div></th>
                  </tr>
                </thead>
                <tbody>
                  {tf.filteredData.length === 0 ? (
                    <tr><td colSpan={10} style={{ textAlign:'center', padding:'40px', color:'var(--muted)' }}>No trades found.</td></tr>
                  ) : tf.filteredData.map(({ trade, execMap, isSub, subName }) => {
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
