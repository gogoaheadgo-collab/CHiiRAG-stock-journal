import React, { useState, useEffect, useCallback, useMemo } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'
import { supabase } from '../lib/supabase'
import { differenceInDays, format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, subMonths, addMonths } from 'date-fns'
import { useTableFilter, FilterDropdown } from '../components/TableFilter'
import Sidebar from '../components/Sidebar'

const ADMIN = 'gogoaheadgo@gmail.com'

function StatCard({ label, value, sub, color }) {
  return (
    <div className="stat-card" style={{ padding:'18px 20px' }}>
      <div style={{ fontSize:'10px', color:'var(--muted)', letterSpacing:'0.12em', textTransform:'uppercase', marginBottom:'8px', fontFamily:'DM Mono, monospace' }}>{label}</div>
      <div style={{ fontSize:'14px', fontWeight:700, fontFamily:"'DM Mono', monospace", color: color||'var(--text)', lineHeight:1.3, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', maxWidth:'100%' }}>{value}</div>
      {sub && <div style={{ fontSize:'11px', color:'var(--muted)', marginTop:'6px', fontFamily:'DM Mono, monospace' }}>{sub}</div>}
    </div>
  )
}

function PnLCalendar({ trades, allExecs }) {
  const [month, setMonth] = useState(new Date())
  const [selectedCalDay, setSelectedCalDay] = useState(null)
  const days = eachDayOfInterval({ start: startOfMonth(month), end: endOfMonth(month) })
  const startDow = startOfMonth(month).getDay()
  const dailyPnL = {}
  trades.filter(t => t.status==='CLOSED' && t.exit_date).forEach(t => {
    const key = t.exit_date.slice(0,10)
    dailyPnL[key] = (dailyPnL[key]||0) + (t._realised||0)
  })
  const toINRd = n => Number(n||0).toLocaleString('en-IN', { minimumFractionDigits:2, maximumFractionDigits:2 })

  // Trades closed on the selected day
  const dayTrades = selectedCalDay
    ? trades.filter(t => t.status==='CLOSED' && t.exit_date?.slice(0,10) === selectedCalDay)
    : []

  return (
    <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'8px', padding:'20px' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'16px' }}>
        <button onClick={() => setMonth(m => subMonths(m,1))} style={{ background:'none', border:'1px solid var(--border)', color:'var(--muted)', borderRadius:'4px', padding:'4px 10px', cursor:'pointer' }}>‹</button>
        <div style={{ textAlign:'center' }}>
          <div style={{ fontFamily:'Bookman Old Style, serif', fontWeight:700, fontSize:'14px', color:'var(--text)' }}>{format(month,'MMMM yyyy')}</div>
          {(() => {
            const monthTotal = Object.entries(dailyPnL)
              .filter(([k]) => k.startsWith(format(month,'yyyy-MM')))
              .reduce((s,[,v]) => s+v, 0)
            return monthTotal !== 0 ? (
              <div style={{ fontSize:'11px', fontWeight:700, fontFamily:'DM Mono, monospace', color:monthTotal>=0?'var(--bull)':'var(--bear)', marginTop:'2px' }}>
                {format(month,'MMM')} P&L: {monthTotal>=0?'+':'−'}{Math.abs(monthTotal).toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2})}
              </div>
            ) : null
          })()}
        </div>
        <button onClick={() => setMonth(m => addMonths(m,1))} style={{ background:'none', border:'1px solid var(--border)', color:'var(--muted)', borderRadius:'4px', padding:'4px 10px', cursor:'pointer' }}>›</button>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:'3px', marginBottom:'3px' }}>
        {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => (
          <div key={d} style={{ textAlign:'center', fontSize:'9px', color:'var(--muted)', padding:'4px 0' }}>{d}</div>
        ))}
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:'3px' }}>
        {Array.from({ length: startDow }).map((_,i) => <div key={`e${i}`} />)}
        {days.map(day => {
          const key = format(day,'yyyy-MM-dd')
          const pnl = dailyPnL[key]
          const isToday = isSameDay(day, new Date())
          const isSelDay = selectedCalDay === key
          return (
            <div key={key}
              onClick={() => pnl != null && setSelectedCalDay(prev => prev === key ? null : key)}
              style={{
                borderRadius:'4px', padding:'6px 4px', textAlign:'center', minHeight:'44px',
                background: isSelDay ? (pnl>=0?'rgba(14,165,233,0.2)':'rgba(239,68,68,0.2)') : pnl!=null ? (pnl>=0?'rgba(14,165,233,0.08)':'rgba(239,68,68,0.08)') : 'transparent',
                border: isSelDay ? `2px solid ${pnl>=0?'var(--bull)':'var(--bear)'}` : isToday ? '1px solid var(--accent)' : pnl!=null ? (pnl>=0?'1px solid rgba(0,230,118,0.3)':'1px solid rgba(255,71,87,0.3)') : '1px solid transparent',
                cursor: pnl!=null ? 'pointer' : 'default',
              }}>
              <div style={{ fontSize:'10px', color:isSelDay?(pnl>=0?'var(--bull)':'var(--bear)'):isToday?'var(--accent)':'var(--muted)', fontWeight:isToday||isSelDay?700:400 }}>{format(day,'d')}</div>
              {pnl!=null && (
                <div style={{ fontSize:'8px', fontWeight:700, marginTop:'2px', color:pnl>=0?'var(--bull)':'var(--bear)', fontFamily:'DM Mono, monospace' }}>
                  {pnl>=0?'+':'−'}Rs.{toINRd(Math.abs(pnl))}
                </div>
              )}
            </div>
          )
        })}
      </div>
      <div style={{ display:'flex', gap:'16px', marginTop:'12px', justifyContent:'center' }}>
        <div style={{ display:'flex', alignItems:'center', gap:'4px' }}>
          <div style={{ width:'10px', height:'10px', borderRadius:'2px', background:'rgba(14,165,233,0.3)', border:'1px solid rgba(0,230,118,0.5)' }} />
          <span style={{ fontSize:'9px', color:'var(--muted)' }}>Profit day</span>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:'4px' }}>
          <div style={{ width:'10px', height:'10px', borderRadius:'2px', background:'rgba(239,68,68,0.3)', border:'1px solid rgba(255,71,87,0.5)' }} />
          <span style={{ fontSize:'9px', color:'var(--muted)' }}>Loss day</span>
        </div>
        {selectedCalDay && (
          <button onClick={() => setSelectedCalDay(null)} style={{ fontSize:'9px', color:'var(--muted)', background:'none', border:'1px solid var(--border)', borderRadius:'3px', padding:'1px 8px', cursor:'pointer', fontFamily:'DM Mono, monospace' }}>✕ clear</button>
        )}
      </div>

      {/* Day Detail Panel */}
      {selectedCalDay && dayTrades.length > 0 && (
        <div style={{ marginTop:'16px', borderTop:'1px solid var(--border)', paddingTop:'14px' }}>
          <div style={{ fontSize:'11px', fontWeight:700, fontFamily:'DM Mono, monospace', color:'var(--text)', marginBottom:'10px' }}>
            {new Date(selectedCalDay+'T00:00:00').toLocaleDateString('en-IN',{ weekday:'long', day:'numeric', month:'long', year:'numeric' })}
            <span style={{ marginLeft:'8px', fontSize:'10px', color:'var(--muted)', fontWeight:400 }}>{dayTrades.length} trade{dayTrades.length>1?'s':''} closed</span>
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
            {dayTrades.map(dayTrade => {
              const dayTradeExecs = (allExecs || []).filter(e => e.trade_id === dayTrade.id)
              const origQty = Number(dayTrade.quantity) || 0
              const exitPrice = dayTradeExecs.length > 0
                ? dayTradeExecs.reduce((s,e) => s + Number(e.price)*Number(e.quantity), 0) / dayTradeExecs.reduce((s,e) => s + Number(e.quantity), 0)
                : (Number(dayTrade.exit_price) || 0)
              const exitQty = dayTradeExecs.length > 0
                ? dayTradeExecs.reduce((s,e) => s + Number(e.quantity), 0)
                : origQty
              // MTF interest for this trade
              const investment = Number(dayTrade.invested_capital) || (Number(dayTrade.entry_price) * origQty)
              const actualInv  = Number(dayTrade.actual_investment) || 0
              const mtfBase    = investment - actualInv
              let dayMtf = 0
              if (mtfBase > 0 && dayTrade.mtf_interest_rate && dayTrade.entry_date) {
                dayMtf = dayTradeExecs.reduce((s,e) => {
                  const days = Math.max(1, Math.floor((new Date(e.date) - new Date(dayTrade.entry_date)) / 86400000))
                  return s + mtfBase * (Number(e.quantity)/origQty) * dayTrade.mtf_interest_rate * days / 36500
                }, 0)
              }
              const dayPnl = dayTrade._realised || 0
              return (
                <div key={dayTrade.id} style={{ background:'var(--bg)', border:`1px solid ${dayPnl>=0?'rgba(14,165,233,0.2)':'rgba(239,68,68,0.2)'}`, borderRadius:'6px', padding:'10px 14px', borderLeft:`3px solid ${dayPnl>=0?'var(--bull)':'var(--bear)'}` }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:'6px' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:'10px', flexWrap:'wrap' }}>
                      <span style={{ fontFamily:'DM Mono, monospace', fontWeight:800, fontSize:'13px', color:'var(--text)' }}>{dayTrade.ticker}</span>
                      {dayTrade.account && <span style={{ fontSize:'10px', color:'var(--muted)', fontFamily:'DM Mono, monospace', background:'var(--surface)', padding:'1px 7px', borderRadius:'3px' }}>{dayTrade.account}</span>}
                      <span style={{ fontSize:'10px', fontFamily:'DM Mono, monospace', color:'var(--muted)' }}>
                        Exit {Number(exitQty).toLocaleString('en-IN')} × Rs.{toINRd(exitPrice)}
                      </span>
                    </div>
                    <div style={{ display:'flex', alignItems:'center', gap:'12px' }}>
                      {dayMtf > 0 && (
                        <div style={{ textAlign:'right' }}>
                          <div style={{ fontSize:'9px', color:'var(--muted)', fontFamily:'DM Mono, monospace', letterSpacing:'0.08em' }}>MTF INT</div>
                          <div style={{ fontSize:'11px', fontWeight:700, fontFamily:'DM Mono, monospace', color:'var(--gold)' }}>Rs.{toINRd(dayMtf)}</div>
                        </div>
                      )}
                      <div style={{ textAlign:'right' }}>
                        <div style={{ fontSize:'9px', color:'var(--muted)', fontFamily:'DM Mono, monospace', letterSpacing:'0.08em' }}>P&L</div>
                        <div style={{ fontSize:'14px', fontWeight:800, fontFamily:'DM Mono, monospace', color:dayPnl>=0?'var(--bull)':'var(--bear)' }}>
                          {dayPnl>=0?'+':'−'}Rs.{toINRd(Math.abs(dayPnl))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

export default function Dashboard() {
  const router = useRouter()
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(false)
  const [trades, setTrades] = useState([])
  const [executions, setExecutions] = useState({})
  const [livePrices, setLivePrices] = useState({})
  const [mirroredAccounts, setMirroredAccounts] = useState([])
  const [mirroredTrades, setMirroredTrades] = useState({})
  const [mirroredExecs, setMirroredExecs] = useState({})
  const [sharedAdminTrades, setSharedAdminTrades] = useState([])
  const [sharedAdminExecs, setSharedAdminExecs] = useState([])

  const isAdmin = session?.user?.email === ADMIN
  const getToken = async () => (await supabase.auth.getSession()).data.session?.access_token

  useEffect(() => {
    supabase.auth.getSession().then(({ data:{ session:s } }) => { setSession(s); if (!s) router.push('/') })
    const { data:{ subscription } } = supabase.auth.onAuthStateChange((_,s) => { setSession(s); if (!s) router.push('/') })
    return () => subscription.unsubscribe()
  }, [])

  const loadData = useCallback(async (silent = false) => {
    if (!session) return
    if (!silent) setLoading(prev => trades.length === 0 ? true : prev)
    const token = await getToken()
    const res = await fetch('/api/trades', { headers:{ Authorization:`Bearer ${token}` } })
    const data = await res.json()
    if (Array.isArray(data)) {
      setTrades(data)
      const execResults = await Promise.all(
        data.map(t => fetch(`/api/executions?trade_id=${t.id}`, { headers:{ Authorization:`Bearer ${token}` } }).then(r=>r.json()).catch(()=>[]))
      )
      const execMap = {}
      data.forEach((t,i) => { execMap[t.id] = Array.isArray(execResults[i]) ? execResults[i] : [] })
      setExecutions(execMap)
      const tickers = [...new Set(data.filter(t=>t.status==='OPEN').map(t=>t.ticker))]
      tickers.forEach(async ticker => {
        try { const r = await fetch(`/api/stock/${ticker}`); const d = await r.json(); if (d.price) setLivePrices(prev=>({...prev,[ticker]:d})) } catch {}
      })
    }
    setLoading(false)
  }, [session])

  useEffect(() => { if (session) loadData() }, [session, loadData])

  // Refresh silently on tab focus — no spinner, always fresh data
  useEffect(() => {
    const onFocus = () => { if (session) loadData(true) }
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [session, loadData])

  // Load shared admin accounts for subscribers
  useEffect(() => {
    if (!session || session.user.email === ADMIN) return
    const load = async () => {
      const token = await getToken()
      // Use dedicated subscriber endpoint — not admin-only one
      const res = await fetch('/api/shared-account-trades', { headers:{ Authorization:`Bearer ${token}` } })
      const data = await res.json()
      if (data.error || !data.trades) return
      setSharedAdminTrades(data.trades)
      setSharedAdminExecs(data.executions||[])
      // Fetch live prices for shared open trades
      const tickers = [...new Set(data.trades.filter(t=>t.status==='OPEN').map(t=>t.ticker))]
      tickers.forEach(async ticker => {
        try { const r = await fetch(`/api/stock/${ticker}`); const d = await r.json(); if (d.price) setLivePrices(prev=>({...prev,[ticker]:d})) } catch {}
      })
    }
    load()
  }, [session])

  useEffect(() => {
    if (session?.user?.email !== ADMIN) return
    const load = async () => {
      const token = await getToken()
      const res = await fetch('/api/admin/mirror', { headers:{ Authorization:`Bearer ${token}` } })
      const data = await res.json()
      if (!Array.isArray(data)) return
      setMirroredAccounts(data)
      data.forEach(async m => {
        const r = await fetch(`/api/admin/subscriber-trades?user_id=${m.subscriber_id}`, { headers:{ Authorization:`Bearer ${token}` } })
        const d = await r.json()
        if (d.trades) {
          setMirroredTrades(prev=>({...prev,[m.subscriber_id]:d.trades}))
          setMirroredExecs(prev=>({...prev,[m.subscriber_id]:d.executions||[]}))
          const tickers = [...new Set(d.trades.filter(t=>t.status==='OPEN').map(t=>t.ticker))]
          tickers.forEach(async ticker => {
            try { const pr = await fetch(`/api/stock/${ticker}`); const pd = await pr.json(); if (pd.price) setLivePrices(prev=>({...prev,[ticker]:pd})) } catch {}
          })
        }
      })
    }
    load()
  }, [session])

  const signOut = async () => { await supabase.auth.signOut(); window.location.href = '/' }

  const handleDeleteMyAccount = async () => {
    if (isAdmin) return
    const confirmed = window.confirm('⚠️ PERMANENTLY DELETE YOUR ACCOUNT?\n\nThis will erase ALL your trades, executions, and account history.\n\nThis CANNOT be undone.')
    if (!confirmed) return
    const typed = window.prompt('Type DELETE to confirm:')
    if (typed !== 'DELETE') { alert('Cancelled.'); return }
    try {
      const token = await getToken()
      const res = await fetch('/api/delete-account', { method:'DELETE', headers:{ Authorization:`Bearer ${token}` } })
      const data = await res.json()
      if (data.error) { alert('Error: ' + data.error); return }
      await supabase.auth.signOut()
      window.location.href = '/'
    } catch (e) { alert('Error: ' + e.message) }
  }

  const toINR = n => Number(n||0).toLocaleString('en-IN', { maximumFractionDigits:0 })
  const toINRd = n => Number(n||0).toLocaleString('en-IN', { minimumFractionDigits:2, maximumFractionDigits:2 })
  const fmtINR = n => {
    const num = Number(n)
    if (isNaN(num)) return '0.00'
    return num.toLocaleString('en-IN', { minimumFractionDigits:2, maximumFractionDigits:2 })
  }

  const calcMTF = (tradeList) => tradeList.reduce((s,t) => {
    if (!t.mtf_interest_rate||!t.entry_date) return s
    const totalVal = Number(t.invested_capital) || (Number(t.entry_price)*Number(t.quantity))
    if (!totalVal) return s
    const margin = Number(t.actual_investment) || 0
    const base = margin > 0 ? totalVal - margin : totalVal
    if (base<=0) return s
    const end = t.status==='CLOSED'&&t.exit_date ? new Date(t.exit_date) : new Date()
    return s + (base*t.mtf_interest_rate*Math.max(1,differenceInDays(end,new Date(t.entry_date))))/36500
  }, 0)

  const calcRealised = (tradeList, execList) => tradeList.reduce((sum,t) => {
    const execs = execList.filter(e=>e.trade_id===t.id)
    return sum + execs.reduce((s,e)=>s+(Number(e.price)-Number(t.entry_price))*Number(e.quantity),0)
  }, 0)

  const calcUnrealised = (tradeList, execList) => tradeList.filter(t=>t.status==='OPEN').reduce((sum,t) => {
    const cmp = livePrices[t.ticker]?.price; if (!cmp) return sum
    const soldQty = execList.filter(e=>e.trade_id===t.id).reduce((s,e)=>s+Number(e.quantity),0)
    const qty = Math.max(0, Number(t.quantity)-soldQty)
    return sum + (t.direction==='SHORT'?(Number(t.entry_price)-cmp)*qty:(cmp-Number(t.entry_price))*qty)
  }, 0)

  const allOwnExecs = Object.values(executions).flat()
  const ownTradeIds = new Set(trades.map(t => t.id))
  const ownUserId = session?.user?.id
  // Exclude mirrored subscribers who are the same user as admin (prevents double-count)
  const otherMirroredTrades = isAdmin
    ? Object.entries(mirroredTrades).filter(([subId]) => subId !== ownUserId).flatMap(([, ts]) => ts)
    : []
  const allMirroredTrades = otherMirroredTrades.filter(t => !ownTradeIds.has(t.id))
  const mirroredTradeIds = new Set(allMirroredTrades.map(t => t.id))
  const allMirroredExecs = isAdmin
    ? Object.entries(mirroredExecs).filter(([subId]) => subId !== ownUserId).flatMap(([, es]) => es).filter(e => mirroredTradeIds.has(e.trade_id))
    : []
  // For subscribers: include shared admin account trades
  const sharedExecsFiltered = sharedAdminTrades.length > 0
    ? sharedAdminExecs.filter(e => sharedAdminTrades.some(t => t.id === e.trade_id))
    : []
  const allTrades = [...trades, ...allMirroredTrades, ...(!isAdmin ? sharedAdminTrades : [])]
  const allExecs = [...allOwnExecs, ...allMirroredExecs, ...(!isAdmin ? sharedExecsFiltered : [])]

  // Attach _realised to closed trades for calendar
  const tradesWithRealised = allTrades.map(t => ({
    ...t,
    _realised: allExecs.filter(e=>e.trade_id===t.id).reduce((s,e)=>s+(Number(e.price)-Number(t.entry_price))*Number(e.quantity),0)
  }))

  const openTrades = allTrades.filter(t=>t.status==='OPEN')
  const closedTrades = allTrades.filter(t=>t.status==='CLOSED')
  const totalRealised = calcRealised(allTrades, allExecs)
  const totalUnrealised = calcUnrealised(allTrades, allExecs)
  const totalMTF = calcMTF(allTrades)
  const wins = closedTrades.filter(t => {
    const r = allExecs.filter(e=>e.trade_id===t.id).reduce((s,e)=>s+(Number(e.price)-Number(t.entry_price))*Number(e.quantity),0)
    return r > 0
  })
  const winRate = closedTrades.length>0 ? (wins.length/closedTrades.length*100).toFixed(1) : '0.0'
  const totalInvested = openTrades.reduce((s,t)=>s+(Number(t.actual_investment)||Number(t.invested_capital)||0),0)

  // Build per-account breakdown — each own account separately + each mirrored subscriber
  const ownAccountNames = [...new Set(trades.map(t => t.account).filter(Boolean))]
  const subscriberBreakdown = isAdmin ? [
    ...ownAccountNames.map(accName => ({
      name: accName,
      trades: trades.filter(t => t.account === accName),
      execs: allOwnExecs.filter(e => trades.filter(t=>t.account===accName).some(t=>t.id===e.trade_id)),
      isOwn: true,
    })),
    ...mirroredAccounts.map(m=>({
      name:(m.subscriber_name||m.subscriber_email||'').split(' ')[0]+"'s",
      trades: allMirroredTrades.filter(t => (mirroredTrades[m.subscriber_id]||[]).some(mt=>mt.id===t.id)),
      execs: allMirroredExecs.filter(e => (mirroredTrades[m.subscriber_id]||[]).some(mt=>mt.id===e.trade_id)),
      isOwn: false,
    }))
  ] : []

  const breakdownRows = useMemo(() =>
    subscriberBreakdown.map(({ name, trades: t, execs: e, isOwn }) => ({
      name, isOwn,
      _open: t.filter(x => x.status === 'OPEN').length,
      _closed: t.filter(x => x.status === 'CLOSED').length,
      _unr: calcUnrealised(t, e),
      _rel: calcRealised(t, e),
      _mtf: calcMTF(t),
    })), [subscriberBreakdown]) // eslint-disable-line react-hooks/exhaustive-deps

  const bdColumns = useMemo(() => [
    { key: 'name', label: 'Account', filterable: true, sortable: true },
    { key: '_open', label: 'Open', sortable: true },
    { key: '_closed', label: 'Closed', sortable: true },
    { key: '_unr', label: 'Unreal. P&L', sortable: true },
    { key: '_rel', label: 'Real. P&L', sortable: true },
    { key: '_mtf', label: 'MTF Int', sortable: true },
  ], [])

  const bd = useTableFilter(breakdownRows, bdColumns)

  const openPositionRows = useMemo(() => openTrades.map(trade => {
    const execs = allExecs.filter(e => e.trade_id === trade.id)
    const soldQty = execs.reduce((s, e) => s + Number(e.quantity), 0)
    const currentQty = Math.max(0, Number(trade.quantity) - soldQty)
    const lp = livePrices[trade.ticker]
    const cmp = lp?.price
    const unr = cmp && currentQty > 0
      ? (trade.direction === 'SHORT' ? (Number(trade.entry_price) - cmp) * currentQty : (cmp - Number(trade.entry_price)) * currentQty)
      : null
    const ownerLabel = (() => {
      if (!isAdmin) return trade.account
      for (const m of mirroredAccounts) {
        if ((mirroredTrades[m.subscriber_id] || []).find(t => t.id === trade.id))
          return (m.subscriber_name || m.subscriber_email || '').split(' ')[0] + "'s"
      }
      return trade.account
    })()
    return { id: trade.id, ticker: trade.ticker, direction: trade.direction, entry_price: Number(trade.entry_price), currentQty, lp, cmp, unr, ownerLabel }
  }), [openTrades, allExecs, livePrices, isAdmin, mirroredAccounts, mirroredTrades])

  const opColumns = useMemo(() => [
    { key: 'ticker', label: 'Ticker', filterable: true, sortable: true },
    { key: 'ownerLabel', label: isAdmin ? 'Owner' : 'Account', filterable: true, sortable: true },
    { key: 'direction', label: 'Dir', filterable: true, sortable: true },
    { key: 'entry_price', label: 'Entry Rs.', sortable: true },
    { key: 'currentQty', label: 'Qty', sortable: true },
    { key: 'cmp', label: 'CMP', sortable: true },
    { key: '_changePercent', label: 'Change %', sortable: true, getSortValue: r => r.lp?.changePercent ?? -Infinity },
    { key: 'unr', label: 'Unreal. P&L', sortable: true },
  ], [isAdmin])

  const op = useTableFilter(openPositionRows, opColumns)

  if (!session) return null

  return (
    <>
      <div className="tricolor-bar" />
      <Head><title>Dashboard — CHiiRAG Stock Journal</title></Head>
      <Sidebar
        active="Dashboard"
        isAdmin={isAdmin}
        user={session?.user}
        onSignOut={signOut}
        onDeleteAccount={!isAdmin ? handleDeleteMyAccount : undefined}
      />

      <main className="sidebar-offset" style={{ padding:'28px 32px 40px' }}>

        <div style={{ marginBottom:'20px', display:'flex', alignItems:'baseline', gap:'10px' }}>
          <h1 style={{ fontFamily:'Bookman Old Style, serif', fontWeight:800, fontSize:'24px', color:'var(--text)', margin:0 }}>
            {isAdmin ? 'Portfolio Overview' : 'My Dashboard'}
          </h1>
          {isAdmin && mirroredAccounts.length>0 && (
            <span style={{ fontSize:'10px', color:'var(--gold)', background:'rgba(245,158,11,0.1)', padding:'2px 8px', borderRadius:'4px', fontFamily:'DM Mono, monospace' }}>
              MY TRADES + {mirroredAccounts.length} MIRRORED
            </span>
          )}
        </div>

        {loading ? (
          <div style={{ textAlign:'center', padding:'60px', color:'var(--muted)' }}>Loading...</div>
        ) : (
          <>
            {/* STAT CARDS */}
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(180px, 1fr))', gap:'14px', marginBottom:'28px' }}>
              <StatCard label="Unrealised P&L" value={`${totalUnrealised>=0?'+':'−'}Rs.${fmtINR(Math.abs(totalUnrealised))}`} color={totalUnrealised>=0?'var(--bull)':'var(--bear)'} sub={`${openTrades.length} open positions`} />
              <StatCard label="Realised P&L" value={`${totalRealised>=0?'+':'−'}Rs.${fmtINR(Math.abs(totalRealised))}`} color={totalRealised>=0?'var(--bull)':'var(--bear)'} sub={`${closedTrades.length} closed trades`} />
              <StatCard label="Win Rate" value={`${winRate}%`} color="var(--accent)" sub={`${wins.length}W · ${closedTrades.length-wins.length}L`} />
              <StatCard label="Open Positions" value={openTrades.length} sub={`Rs.${fmtINR(totalInvested)} deployed`} />
              <StatCard label="MTF Interest" value={`Rs.${fmtINR(totalMTF)}`} color="var(--gold)" sub="Accrued" />
              <StatCard label="Total Trades" value={allTrades.length} sub={`${openTrades.length} open · ${closedTrades.length} closed`} />
            </div>

            {/* ADMIN: per-account breakdown */}
            {isAdmin && subscriberBreakdown.length>1 && (
              <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'8px', padding:'20px', marginBottom:'20px' }}>
                <div style={{ fontFamily:'Bookman Old Style, serif', fontWeight:700, fontSize:'13px', color:'var(--text)', marginBottom:'14px' }}>Account Breakdown</div>
                <table className="data-table">
                    <colgroup>
                      <col style={{ width:'24%' }} />
                      <col style={{ width:'8%' }} />
                      <col style={{ width:'8%' }} />
                      <col style={{ width:'20%' }} />
                      <col style={{ width:'20%' }} />
                      <col style={{ width:'20%' }} />
                    </colgroup>
                    <thead>
                      <tr>
                        {bdColumns.map(col => (
                          <th key={col.key} className={col.key !== 'name' ? 'r' : undefined} style={{ cursor:'pointer' }}
                            onClick={() => bd.handleSort(col.key)}>
                            <div className="col-header" style={col.key !== 'name' ? { justifyContent:'flex-end' } : undefined}>
                              <span>{col.label}</span>
                              <span className={`sort-arrow${bd.sortConfig?.key === col.key ? ' active' : ''}`}>
                                {bd.sortConfig?.key === col.key ? (bd.sortConfig.direction === 'asc' ? '↑' : '↓') : '↕'}
                              </span>
                              {col.filterable && (
                                <span className={`filter-icon${(bd.columnFilters[col.key]?.size || 0) > 0 ? ' has-filter' : ''}`}
                                  onClick={e => bd.openFilter(e, col.key)}>▼</span>
                              )}
                            </div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {bd.filteredData.map(({ name, isOwn, _open, _closed, _unr, _rel, _mtf }) => (
                          <tr key={name} style={{ borderBottom:'1px solid var(--border)' }}>
                            <td style={{ padding:'8px 12px', fontFamily:'DM Mono, monospace', color:'var(--text)' }}>
                              <span style={{ fontWeight:700 }}>{name}</span>
                              {isOwn && <span style={{ marginLeft:'6px', fontSize:'8px', background:'var(--accent-dim)', color:'var(--accent)', padding:'1px 5px', borderRadius:'3px', fontWeight:600 }}>MINE</span>}
                              {!isOwn && <span style={{ marginLeft:'6px', fontSize:'8px', background:'rgba(245,158,11,0.1)', color:'var(--gold)', padding:'1px 5px', borderRadius:'3px', fontWeight:600 }}>MIRRORED</span>}
                            </td>
                            <td style={{ padding:'8px 12px', textAlign:'right', color:'var(--accent)', fontFamily:'DM Mono, monospace' }}>{_open}</td>
                            <td style={{ padding:'8px 12px', textAlign:'right', color:'var(--muted)', fontFamily:'DM Mono, monospace' }}>{_closed}</td>
                            <td style={{ padding:'8px 12px', textAlign:'right', fontWeight:700, fontFamily:'DM Mono, monospace', color:_unr>=0?'var(--bull)':'var(--bear)' }}>{_unr>=0?'+':'−'}Rs.{toINR(Math.abs(_unr))}</td>
                            <td style={{ padding:'8px 12px', textAlign:'right', fontWeight:700, fontFamily:'DM Mono, monospace', color:_rel>=0?'var(--bull)':'var(--bear)' }}>{_rel>=0?'+':'−'}Rs.{toINR(Math.abs(_rel))}</td>
                            <td style={{ padding:'8px 12px', textAlign:'right', color:'var(--gold)', fontFamily:'DM Mono, monospace' }}>Rs.{toINRd(_mtf)}</td>
                          </tr>
                      ))}
                    </tbody>
                  </table>
                {bd.openFilterKey && (
                  <FilterDropdown
                    position={bd.filterDropPos}
                    uniqueValues={bd.getUniqueValues(bd.openFilterKey)}
                    hiddenValues={bd.columnFilters[bd.openFilterKey] || new Set()}
                    onToggle={v => bd.toggleFilterValue(bd.openFilterKey, v)}
                    onSelectAll={() => bd.selectAllFilter(bd.openFilterKey)}
                    onDeselectAll={() => bd.deselectAllFilter(bd.openFilterKey, bd.getUniqueValues(bd.openFilterKey))}
                    onClose={() => bd.setOpenFilterKey(null)}
                  />
                )}
              </div>
            )}

            {/* SUBSCRIBER: shared admin account breakdown */}
            {!isAdmin && sharedAdminTrades.length > 0 && (
              <div style={{ background:'var(--surface)', border:'2px solid var(--accent)', borderRadius:'8px', padding:'20px', marginBottom:'20px' }}>
                <div style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'14px' }}>
                  <div style={{ fontFamily:'Bookman Old Style, serif', fontWeight:700, fontSize:'13px', color:'var(--text)' }}>🔗 Shared by Admin</div>
                  <span style={{ fontSize:'10px', background:'var(--accent-dim)', color:'var(--accent)', padding:'2px 8px', borderRadius:'4px', fontFamily:'DM Mono, monospace', fontWeight:700 }}>READ ONLY</span>
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(140px,1fr))', gap:'10px', marginBottom:'14px' }}>
                  {[...new Set(sharedAdminTrades.map(t => t.account))].map(accName => {
                    const accTrades = sharedAdminTrades.filter(t => t.account === accName)
                    const accExecs = sharedExecsFiltered.filter(e => accTrades.some(t => t.id === e.trade_id))
                    const unr = calcUnrealised(accTrades, accExecs)
                    const rel = calcRealised(accTrades, accExecs)
                    const mtf = calcMTF(accTrades)
                    const open = accTrades.filter(t=>t.status==='OPEN').length
                    const closed = accTrades.filter(t=>t.status==='CLOSED').length
                    return (
                      <div key={accName} style={{ background:'var(--bg)', border:'1px solid var(--border)', borderRadius:'8px', padding:'12px 14px' }}>
                        <div style={{ fontFamily:'DM Mono, monospace', fontWeight:800, fontSize:'13px', color:'var(--accent)', marginBottom:'8px' }}>{accName}</div>
                        <div style={{ display:'flex', flexDirection:'column', gap:'4px' }}>
                          <div style={{ display:'flex', justifyContent:'space-between', fontSize:'10px' }}>
                            <span style={{ color:'var(--muted)', fontFamily:'DM Mono, monospace' }}>Unrealised</span>
                            <span style={{ fontWeight:700, color:unr>=0?'var(--bull)':'var(--bear)', fontFamily:'DM Mono, monospace' }}>{unr>=0?'+':'−'}Rs.{toINR(Math.abs(unr))}</span>
                          </div>
                          <div style={{ display:'flex', justifyContent:'space-between', fontSize:'10px' }}>
                            <span style={{ color:'var(--muted)', fontFamily:'DM Mono, monospace' }}>Realised</span>
                            <span style={{ fontWeight:700, color:rel>=0?'var(--bull)':'var(--bear)', fontFamily:'DM Mono, monospace' }}>{rel>=0?'+':'−'}Rs.{toINR(Math.abs(rel))}</span>
                          </div>
                          <div style={{ display:'flex', justifyContent:'space-between', fontSize:'10px' }}>
                            <span style={{ color:'var(--muted)', fontFamily:'DM Mono, monospace' }}>MTF Int</span>
                            <span style={{ color:'var(--gold)', fontFamily:'DM Mono, monospace' }}>Rs.{toINRd(mtf)}</span>
                          </div>
                          <div style={{ display:'flex', justifyContent:'space-between', fontSize:'10px', marginTop:'2px', paddingTop:'4px', borderTop:'1px solid var(--border)' }}>
                            <span style={{ color:'var(--accent)', fontFamily:'DM Mono, monospace', fontWeight:600 }}>{open} Open</span>
                            <span style={{ color:'var(--muted)', fontFamily:'DM Mono, monospace' }}>{closed} Closed</span>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* OPEN POSITIONS */}
            {openTrades.length>0 && (
              <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'8px', padding:'20px', marginBottom:'20px' }}>
                <div style={{ fontFamily:'Bookman Old Style, serif', fontWeight:700, fontSize:'13px', color:'var(--text)', marginBottom:'14px', display:'flex', alignItems:'center', gap:'8px' }}>
                  Open Positions
                  <span style={{ fontSize:'10px', background:'var(--accent-dim)', color:'var(--accent)', padding:'2px 8px', borderRadius:'4px', fontFamily:'DM Mono, monospace' }}>{openTrades.length}</span>
                </div>
                <table className="data-table">
                    <colgroup>
                      <col style={{ width:'13%' }} />
                      <col style={{ width:'11%' }} />
                      <col style={{ width:'7%' }} />
                      <col style={{ width:'12%' }} />
                      <col style={{ width:'8%' }} />
                      <col style={{ width:'13%' }} />
                      <col style={{ width:'10%' }} />
                      <col style={{ width:'18%' }} />
                    </colgroup>
                    <thead>
                      <tr>
                        {opColumns.map(col => {
                          const isLeft = ['ticker','ownerLabel','direction'].includes(col.key)
                          return (
                            <th key={col.key} className={!isLeft ? 'r' : undefined} style={{ cursor:'pointer' }}
                              onClick={() => op.handleSort(col.key)}>
                              <div className="col-header" style={!isLeft ? { justifyContent:'flex-end' } : undefined}>
                                <span>{col.label}</span>
                                <span className={`sort-arrow${op.sortConfig?.key === col.key ? ' active' : ''}`}>
                                  {op.sortConfig?.key === col.key ? (op.sortConfig.direction === 'asc' ? '↑' : '↓') : '↕'}
                                </span>
                                {col.filterable && (
                                  <span className={`filter-icon${(op.columnFilters[col.key]?.size || 0) > 0 ? ' has-filter' : ''}`}
                                    onClick={e => op.openFilter(e, col.key)}>▼</span>
                                )}
                              </div>
                            </th>
                          )
                        })}
                      </tr>
                    </thead>
                    <tbody>
                      {op.filteredData.map(({ id, ticker, direction, entry_price, currentQty, lp, cmp, unr, ownerLabel }) => (
                        <tr key={id} style={{ borderBottom:'1px solid var(--border)' }}>
                          <td style={{ padding:'8px 12px', fontWeight:700, fontFamily:'DM Mono, monospace' }}>{ticker}</td>
                          <td style={{ padding:'8px 12px', color:'var(--muted)', fontSize:'11px', fontFamily:'DM Mono, monospace' }}>{ownerLabel}</td>
                          <td style={{ padding:'8px 12px' }}>
                            <span style={{ fontSize:'10px', padding:'2px 6px', borderRadius:'3px', fontWeight:700, fontFamily:'DM Mono, monospace',
                              background:direction==='LONG'?'var(--accent-dim)':'var(--bear-dim)',
                              color:direction==='LONG'?'var(--accent)':'var(--bear)' }}>{direction}</span>
                          </td>
                          <td style={{ padding:'8px 12px', textAlign:'right', fontFamily:'DM Mono, monospace' }}>Rs.{toINRd(entry_price)}</td>
                          <td style={{ padding:'8px 12px', textAlign:'right', fontFamily:'DM Mono, monospace' }}>{toINR(currentQty)}</td>
                          <td style={{ padding:'8px 12px', textAlign:'right', fontFamily:'DM Mono, monospace', fontWeight:700 }}>{cmp?`Rs.${toINRd(cmp)}`:'—'}</td>
                          <td style={{ padding:'8px 12px', textAlign:'right', fontFamily:'DM Mono, monospace', fontWeight:700, color:lp?.change>=0?'var(--bull)':'var(--bear)' }}>
                            {lp?.changePercent!=null?`${lp.change>=0?'+':''}${lp.changePercent.toFixed(2)}%`:'—'}
                          </td>
                          <td style={{ padding:'8px 12px', textAlign:'right', fontFamily:'DM Mono, monospace', fontWeight:700, color:unr===null?'var(--muted)':unr>=0?'var(--bull)':'var(--bear)' }}>
                            {unr!==null?`${unr>=0?'+':'−'}${toINRd(Math.abs(unr))}`:'—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                {op.openFilterKey && (
                  <FilterDropdown
                    position={op.filterDropPos}
                    uniqueValues={op.getUniqueValues(op.openFilterKey)}
                    hiddenValues={op.columnFilters[op.openFilterKey] || new Set()}
                    onToggle={v => op.toggleFilterValue(op.openFilterKey, v)}
                    onSelectAll={() => op.selectAllFilter(op.openFilterKey)}
                    onDeselectAll={() => op.deselectAllFilter(op.openFilterKey, op.getUniqueValues(op.openFilterKey))}
                    onClose={() => op.setOpenFilterKey(null)}
                  />
                )}
              </div>
            )}

            {/* CALENDAR + RECENT EXITS */}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 320px', gap:'16px' }}>
              <PnLCalendar trades={tradesWithRealised} allExecs={allExecs} />
              <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'8px', padding:'20px' }}>
                <div style={{ fontFamily:'Bookman Old Style, serif', fontWeight:700, fontSize:'13px', color:'var(--text)', marginBottom:'14px' }}>Recent Exits</div>
                {closedTrades.length===0 ? (
                  <div style={{ color:'var(--muted)', fontSize:'11px', textAlign:'center', padding:'20px 0' }}>No closed trades yet</div>
                ) : (
                  <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
                    {[...tradesWithRealised].filter(t=>t.status==='CLOSED').sort((a,b)=>new Date(b.exit_date||b.updated_at)-new Date(a.exit_date||a.updated_at)).slice(0,8).map(t => (
                      <div key={t.id} style={{
                        display:'flex', justifyContent:'space-between', alignItems:'center',
                        padding:'8px 10px', borderRadius:'5px',
                        background:t._realised>=0?'rgba(14,165,233,0.06)':'rgba(239,68,68,0.06)',
                        border:`1px solid ${t._realised>=0?'rgba(14,165,233,0.2)':'rgba(239,68,68,0.2)'}`,
                      }}>
                        <div>
                          <div style={{ fontWeight:700, fontSize:'12px', color:'var(--text)' }}>{t.ticker}</div>
                          <div style={{ fontSize:'10px', color:'var(--muted)' }}>{t.account} · {t.exit_date?.slice(0,10)}</div>
                        </div>
                        <div style={{ fontSize:'12px', fontWeight:700, fontFamily:'DM Mono, monospace', color:t._realised>=0?'var(--bull)':'var(--bear)' }}>
                          {t._realised>=0?'+':'−'}Rs.{toINR(Math.abs(t._realised))}
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
