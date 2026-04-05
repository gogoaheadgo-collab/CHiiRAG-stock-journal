import React, { useState, useEffect, useCallback } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'
import { supabase } from '../lib/supabase'
import { differenceInDays, format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, subMonths, addMonths } from 'date-fns'

const ADMIN = 'gogoaheadgo@gmail.com'

function NavPill({ active, isAdmin }) {
  const router = useRouter()
  const items = [
    { label: 'Dashboard', path: '/dashboard' },
    { label: 'Accounts', path: '/accounts' },
    ...(isAdmin ? [
      { label: 'Subscribers', path: '/subscribers' },
      { label: 'All Trades', path: '/all-trades' },
    ] : []),
    { label: 'Revenue Sharing', path: '/revenue-sharing' },
    { label: 'Alerts', path: '/alerts' },
    { label: 'Notes', path: '/notes' },
  ]
  return (
    <div style={{ display:'flex', background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'8px', padding:'3px', gap:'2px' }}>
      {items.map(({ label, path }) => (
        <button key={path} onClick={() => router.push(path)} style={{
          padding:'7px 22px', borderRadius:'6px', border:'none', cursor:'pointer',
          fontSize:'11px', fontFamily:'DM Mono, monospace', fontWeight:600,
          background: active===label ? 'var(--accent)' : 'transparent',
          color: active===label ? '#fff' : 'var(--muted)',
        }}>{label}</button>
      ))}
    </div>
  )
}

function StatCard({ label, value, sub, color }) {
  return (
    <div className="stat-card">
      <div style={{ fontSize:'9px', color:'var(--muted)', letterSpacing:'0.12em', textTransform:'uppercase', marginBottom:'6px' }}>{label}</div>
      <div style={{ fontSize:'22px', fontWeight:700, fontFamily:'Bookman Old Style, serif', color: color||'var(--text)' }}>{value}</div>
      {sub && <div style={{ fontSize:'10px', color:'var(--muted)', marginTop:'4px' }}>{sub}</div>}
    </div>
  )
}

function PnLCalendar({ trades }) {
  const [month, setMonth] = useState(new Date())
  const days = eachDayOfInterval({ start: startOfMonth(month), end: endOfMonth(month) })
  const startDow = startOfMonth(month).getDay()
  const dailyPnL = {}
  trades.filter(t => t.status==='CLOSED' && t.exit_date).forEach(t => {
    const key = t.exit_date.slice(0,10)
    dailyPnL[key] = (dailyPnL[key]||0) + (t._realised||0)
  })
  const toINR = n => Number(n||0).toLocaleString('en-IN', { maximumFractionDigits:0 })
  const toINRd = n => Number(n||0).toLocaleString('en-IN', { minimumFractionDigits:2, maximumFractionDigits:2 })
  return (
    <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'8px', padding:'20px' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'16px' }}>
        <button onClick={() => setMonth(m => subMonths(m,1))} style={{ background:'none', border:'1px solid var(--border)', color:'var(--muted)', borderRadius:'4px', padding:'4px 10px', cursor:'pointer' }}>‹</button>
        <span style={{ fontFamily:'Bookman Old Style, serif', fontWeight:700, fontSize:'14px', color:'var(--text)' }}>{format(month,'MMMM yyyy')}</span>
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
          return (
            <div key={key} style={{
              borderRadius:'4px', padding:'6px 4px', textAlign:'center', minHeight:'44px',
              background: pnl!=null ? (pnl>=0?'rgba(14,165,233,0.08)':'rgba(239,68,68,0.08)') : 'transparent',
              border: isToday ? '1px solid var(--accent)' : pnl!=null ? (pnl>=0?'1px solid rgba(0,230,118,0.3)':'1px solid rgba(255,71,87,0.3)') : '1px solid transparent',
            }}>
              <div style={{ fontSize:'10px', color:isToday?'var(--accent)':'var(--muted)', fontWeight:isToday?700:400 }}>{format(day,'d')}</div>
              {pnl!=null && (
                <div style={{ fontSize:'8px', fontWeight:700, marginTop:'2px', color:pnl>=0?'var(--bull)':'var(--bear)', fontFamily:'DM Mono, monospace' }}>
                  {pnl>=0?'+':'−'}Rs{toINRd(Math.abs(pnl))}
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
      </div>
    </div>
  )
}

export default function Dashboard() {
  const router = useRouter()
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [trades, setTrades] = useState([])
  const [executions, setExecutions] = useState({})
  const [livePrices, setLivePrices] = useState({})
  const [mirroredAccounts, setMirroredAccounts] = useState([])
  const [mirroredTrades, setMirroredTrades] = useState({})
  const [mirroredExecs, setMirroredExecs] = useState({})

  const isAdmin = session?.user?.email === ADMIN
  const getToken = async () => (await supabase.auth.getSession()).data.session?.access_token

  useEffect(() => {
    supabase.auth.getSession().then(({ data:{ session:s } }) => { setSession(s); if (!s) router.push('/') })
    const { data:{ subscription } } = supabase.auth.onAuthStateChange((_,s) => { setSession(s); if (!s) router.push('/') })
    return () => subscription.unsubscribe()
  }, [])

  const loadData = useCallback(async () => {
    if (!session) return
    setLoading(true)
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

  // ── EXIT DROPDOWN ──
  const [showExitMenu, setShowExitMenu] = useState(false)
  const exitRef = React.useRef(null)

  React.useEffect(() => {
    const handler = (e) => { if (exitRef.current && !exitRef.current.contains(e.target)) setShowExitMenu(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

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

  const ExitMenu = () => (
    <div ref={exitRef} style={{ position:'relative' }}>
      <button onClick={() => setShowExitMenu(p => !p)} className="btn btn-ghost"
        style={{ padding:'6px 12px', fontSize:'11px', display:'flex', alignItems:'center', gap:'5px' }}>
        EXIT <span style={{ fontSize:'9px' }}>{showExitMenu ? '▲' : '▼'}</span>
      </button>
      {showExitMenu && (
        <div style={{ position:'absolute', right:0, top:'calc(100% + 6px)', background:'var(--surface)',
          border:'1px solid var(--border)', borderRadius:'8px', minWidth:'190px',
          boxShadow:'0 8px 24px rgba(0,0,0,0.5)', zIndex:1000, overflow:'hidden' }}>
          <button onClick={() => { setShowExitMenu(false); signOut() }}
            style={{ display:'block', width:'100%', padding:'11px 16px', background:'none', border:'none',
              textAlign:'left', cursor:'pointer', fontSize:'12px', color:'var(--text)',
              fontFamily:'DM Mono, monospace', borderBottom:'1px solid var(--border)' }}
            onMouseEnter={e => e.currentTarget.style.background='rgba(255,255,255,0.05)'}
            onMouseLeave={e => e.currentTarget.style.background='none'}>
            🚪&nbsp; Sign Out
          </button>
          {!isAdmin && (
            <button onClick={() => { setShowExitMenu(false); handleDeleteMyAccount() }}
              style={{ display:'block', width:'100%', padding:'11px 16px', background:'none', border:'none',
                textAlign:'left', cursor:'pointer', fontSize:'12px', color:'var(--bear)',
                fontFamily:'DM Mono, monospace' }}
              onMouseEnter={e => e.currentTarget.style.background='rgba(239,68,68,0.08)'}
              onMouseLeave={e => e.currentTarget.style.background='none'}>
              🗑&nbsp; Delete My Account
            </button>
          )}
        </div>
      )}
    </div>
  )

  const toINR = n => Number(n||0).toLocaleString('en-IN', { maximumFractionDigits:0 })
  const toINRd = n => Number(n||0).toLocaleString('en-IN', { minimumFractionDigits:2, maximumFractionDigits:2 })

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
  const allTrades = [...trades, ...allMirroredTrades]
  const allExecs = [...allOwnExecs, ...allMirroredExecs]

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

  if (!session) return null

  return (
    <>
      <div className="tricolor-bar" />
      <Head><title>Dashboard — CHiiRAG Stock Journal</title></Head>
      <header className="header">
        <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
          <div className="india-flag-logo-sm" style={{ display:'flex', flexDirection:'column' }}>
            <div style={{ flex:1, background:'#FF9933' }} />
            <div style={{ flex:1, background:'#fff', display:'flex', alignItems:'center', justifyContent:'center' }}>
              <div style={{ width:'8px', height:'8px', borderRadius:'50%', border:'1.5px solid #000080' }} />
            </div>
            <div style={{ flex:1, background:'#138808' }} />
          </div>
          <div style={{ fontFamily:'Bookman Old Style, serif', fontWeight:800, fontSize:'15px', color:'var(--text)' }}>CHiiRAG <span style={{ color:'var(--accent)' }}>STOCK Journal</span></div>
        </div>
        <NavPill active="Dashboard" isAdmin={isAdmin} />
        <ExitMenu />
      </header>

      <main style={{ maxWidth:'1300px', margin:'0 auto', padding:'24px 16px' }}>

        <div style={{ marginBottom:'20px', display:'flex', alignItems:'baseline', gap:'10px' }}>
          <h1 style={{ fontFamily:'Bookman Old Style, serif', fontWeight:800, fontSize:'20px', color:'var(--text)', margin:0 }}>
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
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(160px,1fr))', gap:'12px', marginBottom:'24px' }}>
              <StatCard label="Unrealised P&L" value={`${totalUnrealised>=0?'+':'−'}Rs${toINRd(Math.abs(totalUnrealised))}`} color={totalUnrealised>=0?'var(--bull)':'var(--bear)'} sub={`${openTrades.length} open positions`} />
              <StatCard label="Realised P&L" value={`${totalRealised>=0?'+':'−'}Rs${toINRd(Math.abs(totalRealised))}`} color={totalRealised>=0?'var(--bull)':'var(--bear)'} sub={`${closedTrades.length} closed trades`} />
              <StatCard label="Win Rate" value={`${winRate}%`} color="var(--accent)" sub={`${wins.length}W · ${closedTrades.length-wins.length}L`} />
              <StatCard label="Open Positions" value={openTrades.length} sub={`Rs${toINR(totalInvested)} deployed`} />
              <StatCard label="MTF Interest" value={`Rs${toINRd(totalMTF)}`} color="var(--gold)" sub="Accrued" />
              <StatCard label="Total Trades" value={allTrades.length} sub={`${openTrades.length} open · ${closedTrades.length} closed`} />
            </div>

            {/* ADMIN: per-account breakdown */}
            {isAdmin && subscriberBreakdown.length>1 && (
              <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'8px', padding:'20px', marginBottom:'20px' }}>
                <div style={{ fontFamily:'Bookman Old Style, serif', fontWeight:700, fontSize:'13px', color:'var(--text)', marginBottom:'14px' }}>Account Breakdown</div>
                <div style={{ overflowX:'auto' }}>
                  <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'12px' }}>
                    <thead>
                      <tr style={{ borderBottom:'1px solid var(--border)' }}>
                        {['Account','Open','Closed','Unrealised P&L','Realised P&L','MTF Interest'].map(h => (
                          <th key={h} style={{ padding:'6px 12px', textAlign:h==='Account'?'left':'right', fontSize:'10px', color:'var(--muted)', fontFamily:'DM Mono, monospace', fontWeight:600 }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {subscriberBreakdown.map(({ name, trades:t, execs:e, isOwn }) => {
                        const unr = calcUnrealised(t,e), rel = calcRealised(t,e), mtf = calcMTF(t)
                        return (
                          <tr key={name} style={{ borderBottom:'1px solid var(--border)' }}>
                            <td style={{ padding:'8px 12px', fontFamily:'DM Mono, monospace', color:'var(--text)' }}>
                              <span style={{ fontWeight:700 }}>{name}</span>
                              {isOwn && <span style={{ marginLeft:'6px', fontSize:'8px', background:'var(--accent-dim)', color:'var(--accent)', padding:'1px 5px', borderRadius:'3px', fontWeight:600 }}>MINE</span>}
                              {!isOwn && <span style={{ marginLeft:'6px', fontSize:'8px', background:'rgba(245,158,11,0.1)', color:'var(--gold)', padding:'1px 5px', borderRadius:'3px', fontWeight:600 }}>MIRRORED</span>}
                            </td>
                            <td style={{ padding:'8px 12px', textAlign:'right', color:'var(--accent)', fontFamily:'DM Mono, monospace' }}>{t.filter(x=>x.status==='OPEN').length}</td>
                            <td style={{ padding:'8px 12px', textAlign:'right', color:'var(--muted)', fontFamily:'DM Mono, monospace' }}>{t.filter(x=>x.status==='CLOSED').length}</td>
                            <td style={{ padding:'8px 12px', textAlign:'right', fontWeight:700, fontFamily:'DM Mono, monospace', color:unr>=0?'var(--bull)':'var(--bear)' }}>{unr>=0?'+':'−'}Rs{toINR(Math.abs(unr))}</td>
                            <td style={{ padding:'8px 12px', textAlign:'right', fontWeight:700, fontFamily:'DM Mono, monospace', color:rel>=0?'var(--bull)':'var(--bear)' }}>{rel>=0?'+':'−'}Rs{toINR(Math.abs(rel))}</td>
                            <td style={{ padding:'8px 12px', textAlign:'right', color:'var(--gold)', fontFamily:'DM Mono, monospace' }}>Rs{toINRd(mtf)}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
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
                <div style={{ overflowX:'auto' }}>
                  <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'12px' }}>
                    <thead>
                      <tr style={{ borderBottom:'1px solid var(--border)' }}>
                        {['Ticker', isAdmin?'Owner':'Account', 'Dir', 'Entry Rs', 'Qty', 'CMP', 'Change %', 'Unrealised P&L'].map(h => (
                          <th key={h} style={{ padding:'6px 12px', textAlign:['Ticker',isAdmin?'Owner':'Account','Dir'].includes(h)?'left':'right', fontSize:'10px', color:'var(--muted)', fontFamily:'DM Mono, monospace', fontWeight:600, whiteSpace:'nowrap' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {openTrades.map(trade => {
                        const execs = allExecs.filter(e=>e.trade_id===trade.id)
                        const soldQty = execs.reduce((s,e)=>s+Number(e.quantity),0)
                        const currentQty = Math.max(0, Number(trade.quantity)-soldQty)
                        const lp = livePrices[trade.ticker]
                        const cmp = lp?.price
                        const unr = cmp&&currentQty>0 ? (trade.direction==='SHORT'?(Number(trade.entry_price)-cmp)*currentQty:(cmp-Number(trade.entry_price))*currentQty) : null
                        const ownerLabel = (() => {
                          if (!isAdmin) return trade.account
                          for (const m of mirroredAccounts) {
                            if ((mirroredTrades[m.subscriber_id]||[]).find(t=>t.id===trade.id))
                              return (m.subscriber_name||m.subscriber_email||'').split(' ')[0]+"'s"
                          }
                          return trade.account
                        })()
                        return (
                          <tr key={trade.id} style={{ borderBottom:'1px solid var(--border)' }}>
                            <td style={{ padding:'8px 12px', fontWeight:700, fontFamily:'DM Mono, monospace' }}>{trade.ticker}</td>
                            <td style={{ padding:'8px 12px', color:'var(--muted)', fontSize:'11px', fontFamily:'DM Mono, monospace' }}>{ownerLabel}</td>
                            <td style={{ padding:'8px 12px' }}>
                              <span style={{ fontSize:'10px', padding:'2px 6px', borderRadius:'3px', fontWeight:700, fontFamily:'DM Mono, monospace',
                                background:trade.direction==='LONG'?'var(--accent-dim)':'var(--bear-dim)',
                                color:trade.direction==='LONG'?'var(--accent)':'var(--bear)' }}>{trade.direction}</span>
                            </td>
                            <td style={{ padding:'8px 12px', textAlign:'right', fontFamily:'DM Mono, monospace' }}>Rs{toINRd(trade.entry_price)}</td>
                            <td style={{ padding:'8px 12px', textAlign:'right', fontFamily:'DM Mono, monospace' }}>{toINR(currentQty)}</td>
                            <td style={{ padding:'8px 12px', textAlign:'right', fontFamily:'DM Mono, monospace', fontWeight:700 }}>{cmp?`Rs${toINRd(cmp)}`:'—'}</td>
                            <td style={{ padding:'8px 12px', textAlign:'right', fontFamily:'DM Mono, monospace', fontWeight:700, color:lp?.change>=0?'var(--bull)':'var(--bear)' }}>
                              {lp?.changePercent!=null?`${lp.change>=0?'+':''}${lp.changePercent.toFixed(2)}%`:'—'}
                            </td>
                            <td style={{ padding:'8px 12px', textAlign:'right', fontFamily:'DM Mono, monospace', fontWeight:700, color:unr===null?'var(--muted)':unr>=0?'var(--bull)':'var(--bear)' }}>
                              {unr!==null?`${unr>=0?'+':'−'}Rs${toINRd(Math.abs(unr))}`:'—'}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* CALENDAR + RECENT EXITS */}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 320px', gap:'16px' }}>
              <PnLCalendar trades={tradesWithRealised} />
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
                          {t._realised>=0?'+':'−'}Rs{toINR(Math.abs(t._realised))}
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

