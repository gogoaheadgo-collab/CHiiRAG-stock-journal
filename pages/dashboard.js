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

function PnLCalendar({ trades, allExecs, resultAnnouncements = [] }) {
  const [month, setMonth] = useState(new Date())
  const [selectedCalDay, setSelectedCalDay] = useState(null)
  const days = eachDayOfInterval({ start: startOfMonth(month), end: endOfMonth(month) })
  const startDow = startOfMonth(month).getDay()
  const dailyPnL = {}
  // P&L by individual execution date (each partial/full exit on its own date)
  ;(allExecs || []).forEach(exec => {
    const trade = trades.find(t => t.id === exec.trade_id)
    if (!trade) return
    const execDate = (exec.date || exec.created_at || '').split('T')[0]
    if (!execDate) return
    const pnl = (Number(exec.price) - Number(trade.entry_price)) * Number(exec.quantity)
    dailyPnL[execDate] = (dailyPnL[execDate] || 0) + pnl
  })
  // Also include trades closed directly without any executions
  trades.forEach(trade => {
    if (trade.status !== 'CLOSED' || !trade.exit_date || !trade.exit_price) return
    if ((allExecs || []).some(e => e.trade_id === trade.id)) return
    const closeDate = trade.exit_date.split('T')[0]
    const pnl = (Number(trade.exit_price) - Number(trade.entry_price)) * Number(trade.quantity)
    dailyPnL[closeDate] = (dailyPnL[closeDate] || 0) + pnl
  })
  const toINRd = n => Number(n||0).toLocaleString('en-IN', { minimumFractionDigits:2, maximumFractionDigits:2 })

  // Result announcements map: dateStr → [{ticker, stock_name}]
  const resultDatesMap = {}
  ;(resultAnnouncements || []).forEach(r => {
    if (!resultDatesMap[r.result_date]) resultDatesMap[r.result_date] = []
    resultDatesMap[r.result_date].push({ ticker: r.ticker, stock_name: r.stock_name })
  })

  // Executions on the selected day + directly-closed trades (no executions)
  const dayExecs = selectedCalDay
    ? (allExecs || []).filter(e => (e.date || e.created_at || '').split('T')[0] === selectedCalDay)
    : []
  const dayDirectTrades = selectedCalDay
    ? trades.filter(t => t.status==='CLOSED' && t.exit_date?.split('T')[0] === selectedCalDay && !(allExecs || []).some(e => e.trade_id === t.id))
    : []

  return (
    <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'8px', padding:'16px' }}>
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
      <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:'4px', marginBottom:'3px' }}>
        {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => (
          <div key={d} style={{ textAlign:'center', fontSize:'11px', color:'var(--muted)', padding:'4px 0' }}>{d}</div>
        ))}
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:'4px' }}>
        {Array.from({ length: startDow }).map((_,i) => <div key={`e${i}`} />)}
        {days.map(day => {
          const key = format(day,'yyyy-MM-dd')
          const pnl = dailyPnL[key]
          const isToday = isSameDay(day, new Date())
          const isSelDay = selectedCalDay === key
          return (
            <div key={key}
              onClick={() => (pnl != null || resultDatesMap[key]) && setSelectedCalDay(prev => prev === key ? null : key)}
              style={{
                borderRadius:'4px', padding:'8px 6px', textAlign:'center', minHeight:'56px',
                background: isSelDay
                  ? (pnl!=null ? (pnl>=0?'rgba(14,165,233,0.2)':'rgba(239,68,68,0.2)') : 'rgba(124,58,237,0.2)')
                  : pnl!=null ? (pnl>=0?'rgba(14,165,233,0.08)':'rgba(239,68,68,0.08)')
                  : resultDatesMap[key] ? 'rgba(124,58,237,0.08)' : 'transparent',
                border: isSelDay
                  ? `2px solid ${pnl!=null?(pnl>=0?'var(--bull)':'var(--bear)'):'#7c3aed'}`
                  : isToday ? '1px solid var(--accent)'
                  : pnl!=null ? (pnl>=0?'1px solid rgba(0,230,118,0.3)':'1px solid rgba(255,71,87,0.3)')
                  : resultDatesMap[key] ? '1px solid rgba(124,58,237,0.4)' : '1px solid transparent',
                cursor: (pnl!=null || resultDatesMap[key]) ? 'pointer' : 'default',
              }}>
              <div style={{ fontSize:'12px', color:isSelDay?(pnl!=null?(pnl>=0?'var(--bull)':'var(--bear)'):'#a78bfa'):isToday?'var(--accent)':'var(--muted)', fontWeight:isToday||isSelDay?700:400 }}>{format(day,'d')}</div>
              {pnl!=null && (
                <div style={{ fontSize:'10px', fontWeight:700, marginTop:'2px', color:pnl>=0?'var(--bull)':'var(--bear)', fontFamily:'DM Mono, monospace' }}>
                  {pnl>=0?'+':'−'}Rs.{toINRd(Math.abs(pnl))}
                </div>
              )}
              {resultDatesMap[key] && (
                <div style={{ display:'flex', justifyContent:'center', marginTop:'3px', gap:'2px' }}>
                  <div style={{ width:'5px', height:'5px', borderRadius:'50%', background:'#7c3aed' }} />
                </div>
              )}
            </div>
          )
        })}
      </div>
      <div style={{ display:'flex', gap:'16px', marginTop:'10px', justifyContent:'center' }}>
        <div style={{ display:'flex', alignItems:'center', gap:'4px' }}>
          <div style={{ width:'10px', height:'10px', borderRadius:'2px', background:'rgba(14,165,233,0.3)', border:'1px solid rgba(0,230,118,0.5)' }} />
          <span style={{ fontSize:'9px', color:'var(--muted)' }}>Profit day</span>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:'4px' }}>
          <div style={{ width:'10px', height:'10px', borderRadius:'2px', background:'rgba(239,68,68,0.3)', border:'1px solid rgba(255,71,87,0.5)' }} />
          <span style={{ fontSize:'9px', color:'var(--muted)' }}>Loss day</span>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:'4px' }}>
          <div style={{ width:'10px', height:'10px', borderRadius:'50%', background:'rgba(124,58,237,0.5)', border:'1px solid rgba(124,58,237,0.8)' }} />
          <span style={{ fontSize:'9px', color:'var(--muted)' }}>Results day</span>
        </div>
        {selectedCalDay && (
          <button onClick={() => setSelectedCalDay(null)} style={{ fontSize:'9px', color:'var(--muted)', background:'none', border:'1px solid var(--border)', borderRadius:'3px', padding:'1px 8px', cursor:'pointer', fontFamily:'DM Mono, monospace' }}>✕ clear</button>
        )}
      </div>

      {/* Day Detail Panel */}
      {selectedCalDay && (dayExecs.length > 0 || dayDirectTrades.length > 0 || (resultDatesMap[selectedCalDay]?.length > 0)) && (
        <div style={{ marginTop:'16px', borderTop:'1px solid var(--border)', paddingTop:'14px' }}>
          <div style={{ fontSize:'11px', fontWeight:700, fontFamily:'DM Mono, monospace', color:'var(--text)', marginBottom:'10px' }}>
            {new Date(selectedCalDay+'T00:00:00').toLocaleDateString('en-IN',{ weekday:'long', day:'numeric', month:'long', year:'numeric' })}
            <span style={{ marginLeft:'8px', fontSize:'10px', color:'var(--muted)', fontWeight:400 }}>{dayExecs.length + dayDirectTrades.length} exit{(dayExecs.length + dayDirectTrades.length)>1?'s':''}</span>
          </div>
          {/* Results section — shown above exits */}
          {resultDatesMap[selectedCalDay]?.length > 0 && (
            <div style={{ marginBottom:'12px' }}>
              <div style={{ fontSize:'10px', fontWeight:700, fontFamily:'DM Mono, monospace', color:'#a78bfa', letterSpacing:'0.1em', marginBottom:'6px' }}>📊 RESULTS ANNOUNCEMENT</div>
              <div style={{ display:'flex', flexDirection:'column', gap:'6px' }}>
                {resultDatesMap[selectedCalDay].map((r, ri) => (
                  <div key={ri} style={{ background:'rgba(124,58,237,0.08)', border:'1px solid rgba(124,58,237,0.35)', borderRadius:'6px', padding:'8px 12px', borderLeft:'3px solid #7c3aed', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                    <div>
                      <span style={{ fontFamily:'DM Mono, monospace', fontWeight:800, fontSize:'13px', color:'var(--text)' }}>{r.ticker}</span>
                      {r.stock_name && r.stock_name !== r.ticker && (
                        <span style={{ marginLeft:'8px', fontSize:'10px', color:'var(--muted)' }}>{r.stock_name}</span>
                      )}
                    </div>
                    <div style={{ fontSize:'10px', fontWeight:700, fontFamily:'DM Mono, monospace', color:'#a78bfa', background:'rgba(124,58,237,0.15)', padding:'2px 8px', borderRadius:'3px' }}>RESULTS</div>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
            {dayExecs.map(exec => {
              const trade = trades.find(t => t.id === exec.trade_id)
              if (!trade) return null
              const origQty = Number(trade.quantity) || 0
              const investment = Number(trade.invested_capital) || (Number(trade.entry_price) * origQty)
              const mtfBase = investment - (Number(trade.actual_investment) || 0)
              const dayMtf = mtfBase > 0 && trade.mtf_interest_rate && trade.entry_date
                ? mtfBase * (Number(exec.quantity)/origQty) * trade.mtf_interest_rate * Math.max(1, Math.floor((new Date(exec.date) - new Date(trade.entry_date)) / 86400000)) / 36500
                : 0
              const pnl = (Number(exec.price) - Number(trade.entry_price)) * Number(exec.quantity)
              return (
                <div key={exec.id} style={{ background:'var(--bg)', border:`1px solid ${pnl>=0?'rgba(14,165,233,0.2)':'rgba(239,68,68,0.2)'}`, borderRadius:'6px', padding:'10px 14px', borderLeft:`3px solid ${pnl>=0?'var(--bull)':'var(--bear)'}` }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:'6px' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:'10px', flexWrap:'wrap' }}>
                      <span style={{ fontFamily:'DM Mono, monospace', fontWeight:800, fontSize:'13px', color:'var(--text)' }}>{trade.ticker}</span>
                      {trade.account && <span style={{ fontSize:'10px', color:'var(--muted)', fontFamily:'DM Mono, monospace', background:'var(--surface)', padding:'1px 7px', borderRadius:'3px' }}>{trade.account}</span>}
                      <span style={{ fontSize:'10px', fontFamily:'DM Mono, monospace', color:'var(--muted)' }}>
                        Sell {Number(exec.quantity).toLocaleString('en-IN')} × Rs.{toINRd(Number(exec.price))}
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
                        <div style={{ fontSize:'14px', fontWeight:800, fontFamily:'DM Mono, monospace', color:pnl>=0?'var(--bull)':'var(--bear)' }}>
                          {pnl>=0?'+':'−'}Rs.{toINRd(Math.abs(pnl))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
            {dayDirectTrades.map(trade => {
              const pnl = (Number(trade.exit_price) - Number(trade.entry_price)) * Number(trade.quantity)
              return (
                <div key={trade.id} style={{ background:'var(--bg)', border:`1px solid ${pnl>=0?'rgba(14,165,233,0.2)':'rgba(239,68,68,0.2)'}`, borderRadius:'6px', padding:'10px 14px', borderLeft:`3px solid ${pnl>=0?'var(--bull)':'var(--bear)'}` }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:'6px' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:'10px', flexWrap:'wrap' }}>
                      <span style={{ fontFamily:'DM Mono, monospace', fontWeight:800, fontSize:'13px', color:'var(--text)' }}>{trade.ticker}</span>
                      {trade.account && <span style={{ fontSize:'10px', color:'var(--muted)', fontFamily:'DM Mono, monospace', background:'var(--surface)', padding:'1px 7px', borderRadius:'3px' }}>{trade.account}</span>}
                      <span style={{ fontSize:'10px', fontFamily:'DM Mono, monospace', color:'var(--muted)' }}>
                        Exit {Number(trade.quantity).toLocaleString('en-IN')} × Rs.{toINRd(Number(trade.exit_price))}
                      </span>
                    </div>
                    <div style={{ textAlign:'right' }}>
                      <div style={{ fontSize:'9px', color:'var(--muted)', fontFamily:'DM Mono, monospace', letterSpacing:'0.08em' }}>P&L</div>
                      <div style={{ fontSize:'14px', fontWeight:800, fontFamily:'DM Mono, monospace', color:pnl>=0?'var(--bull)':'var(--bear)' }}>
                        {pnl>=0?'+':'−'}Rs.{toINRd(Math.abs(pnl))}
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
  const [ownAccounts, setOwnAccounts] = useState([])
  const [mirroredAccounts, setMirroredAccounts] = useState([])
  const [resultAnnouncements, setResultAnnouncements] = useState([])
  const [mirroredTrades, setMirroredTrades] = useState({})
  const [mirroredExecs, setMirroredExecs] = useState({})
  const [mirroredSubAccounts, setMirroredSubAccounts] = useState({})
  const [allSubscribers, setAllSubscribers] = useState([])
  const [sharedAdminTrades, setSharedAdminTrades] = useState([])
  const [sharedAdminExecs, setSharedAdminExecs] = useState([])
  const [selectedAccounts, setSelectedAccounts] = useState(() => {
    if (typeof window === 'undefined') return new Set()
    try {
      const saved = localStorage.getItem('dashboard_selected_accounts')
      return saved ? new Set(JSON.parse(saved)) : new Set()
    } catch { return new Set() }
  })

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
    const [{ data: tradesData }, { data: execsData }, { data: accountsData }] = await Promise.all([
      supabase.from('trades').select('*').eq('user_id', session.user.id).order('entry_date', { ascending: false }),
      supabase.from('executions').select('*').eq('user_id', session.user.id).order('date', { ascending: true }),
      supabase.from('accounts').select('id, name, available_fund').eq('user_id', session.user.id),
    ])
    if (Array.isArray(accountsData)) setOwnAccounts(accountsData)
    if (Array.isArray(tradesData)) {
      setTrades(tradesData)
      const execMap = {}
      tradesData.forEach(t => { execMap[t.id] = [] })
      ;(execsData || []).forEach(e => { if (execMap[e.trade_id] !== undefined) execMap[e.trade_id].push(e) })
      setExecutions(execMap)
      const tickers = [...new Set(tradesData.filter(t=>t.status==='OPEN').map(t=>t.ticker))]
      tickers.forEach(async ticker => {
        try { const r = await fetch(`/api/stock/${ticker}`); const d = await r.json(); if (d.price) setLivePrices(prev=>({...prev,[ticker]:d})) } catch {}
      })
    }
    setLoading(false)
    // Fetch result announcements (no auth required)
    try {
      const ra = await fetch('/api/result-announcements')
      const raData = await ra.json()
      if (Array.isArray(raData)) setResultAnnouncements(raData)
    } catch {}
  }, [session])

  useEffect(() => { if (session) loadData() }, [session, loadData])

  // Refresh silently on tab focus — no spinner, always fresh data
  useEffect(() => {
    const onFocus = () => { if (session) loadData(true) }
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [session, loadData])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('dashboard_selected_accounts', JSON.stringify([...selectedAccounts]))
    }
  }, [selectedAccounts])

  const toggleAccount = (name) => {
    setSelectedAccounts(prev => {
      const next = new Set(prev)
      next.has(name) ? next.delete(name) : next.add(name)
      return next
    })
  }

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
      const [res, resAll] = await Promise.all([
        fetch('/api/admin/mirror', { headers:{ Authorization:`Bearer ${token}` } }),
        fetch('/api/admin/all-subscribers', { headers:{ Authorization:`Bearer ${token}` } }),
      ])
      const data = await res.json()
      const allSubs = await resAll.json()
      if (!Array.isArray(data)) return
      setMirroredAccounts(data)
      if (Array.isArray(allSubs)) setAllSubscribers(allSubs)
      const allToFetch = [
        ...data.map(m => ({ id: m.subscriber_id, name: m.subscriber_name || m.subscriber_email || '', isMirrored: true })),
        ...(Array.isArray(allSubs) ? allSubs.filter(s => !data.some(m => m.subscriber_id === s.id)).map(s => ({ id: s.id, name: s.name, isMirrored: false })) : [])
      ]
      allToFetch.forEach(async m => {
        const r = await fetch(`/api/admin/subscriber-trades?user_id=${m.id}`, { headers:{ Authorization:`Bearer ${token}` } })
        const d = await r.json()
        if (d.trades) {
          setMirroredTrades(prev=>({...prev,[m.id]:d.trades}))
          setMirroredExecs(prev=>({...prev,[m.id]:d.executions||[]}))
          setMirroredSubAccounts(prev=>({...prev,[m.id]:d.accounts||[]}))
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
  // Also exclude unfetched subscribers — their data should not affect tiles
  const fetchedSubIds = new Set(mirroredAccounts.map(m => m.subscriber_id))
  const otherMirroredTrades = isAdmin
    ? Object.entries(mirroredTrades).filter(([subId]) => subId !== ownUserId && fetchedSubIds.has(subId)).flatMap(([, ts]) => ts)
    : []
  const allMirroredTrades = otherMirroredTrades.filter(t => !ownTradeIds.has(t.id))
  const mirroredTradeIds = new Set(allMirroredTrades.map(t => t.id))
  const allMirroredExecs = isAdmin
    ? Object.entries(mirroredExecs).filter(([subId]) => subId !== ownUserId && fetchedSubIds.has(subId)).flatMap(([, es]) => es).filter(e => mirroredTradeIds.has(e.trade_id))
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
  const fundDeployed = openTrades.reduce((s, t) => {
    const totalQty = Number(t.quantity) || 0
    if (totalQty === 0) return s
    const soldQty = allExecs.filter(e => e.trade_id === t.id).reduce((sum, e) => sum + Number(e.quantity), 0)
    const currentQty = Math.max(0, totalQty - soldQty)
    const actualInv = Number(t.actual_investment) || (Number(t.entry_price) * totalQty) || 0
    return s + (currentQty * actualInv) / totalQty
  }, 0)

  const openPositions = useMemo(() => {
    const byTicker = {}
    openTrades.forEach(t => {
      const ticker = t.ticker.toUpperCase()
      if (!byTicker[ticker]) byTicker[ticker] = { ticker, trades: [], accounts: new Set() }
      byTicker[ticker].trades.push(t)
      if (t.account) byTicker[ticker].accounts.add(t.account)
    })
    return Object.values(byTicker).map(({ ticker, trades, accounts }) => {
      const cmp = livePrices[ticker]?.price || 0
      let currentQty = 0, unrealised = 0, realised = 0
      trades.forEach(t => {
        const totalQty = Number(t.quantity) || 0
        const soldQty = allExecs.filter(e => e.trade_id === t.id).reduce((s, e) => s + Number(e.quantity), 0)
        const qty = Math.max(0, totalQty - soldQty)
        currentQty += qty
        if (cmp && qty > 0) unrealised += t.direction === 'SHORT' ? (Number(t.entry_price) - cmp) * qty : (cmp - Number(t.entry_price)) * qty
        realised += allExecs.filter(e => e.trade_id === t.id).reduce((s, e) => s + (Number(e.price) - Number(t.entry_price)) * Number(e.quantity), 0)
      })
      return { ticker, currentQty, numAccounts: accounts.size, cmp, changePercent: livePrices[ticker]?.changePercent ?? null, unrealised, realised }
    }).sort((a, b) => a.ticker.localeCompare(b.ticker))
  }, [openTrades, allExecs, livePrices]) // eslint-disable-line react-hooks/exhaustive-deps

  const opColumns = useMemo(() => [
    { key:'ticker',      label:'TICKER',         getValue:      r => r.ticker,        sortable:true, filterable:true },
    { key:'currentQty',  label:'CURR QTY',       getSortValue:  r => r.currentQty,    sortable:true },
    { key:'numAccounts', label:'ACCOUNTS',        getSortValue:  r => r.numAccounts,   sortable:true, filterable:true, getValue: r => String(r.numAccounts) },
    { key:'cmp',         label:'CMP',             getSortValue:  r => r.cmp || 0,      sortable:true },
    { key:'unrealised',  label:'UNREALISED P&L',  getSortValue:  r => r.unrealised,    sortable:true },
    { key:'realised',    label:'REALISED P&L',    getSortValue:  r => r.realised,      sortable:true },
  ], [])

  const op = useTableFilter(openPositions, opColumns)

  // Build per-account breakdown — each own account separately + each mirrored subscriber
  const ownAccountNames = [...new Set(trades.map(t => t.account).filter(Boolean))]
  const subscriberBreakdown = isAdmin ? [
    ...ownAccountNames.map(accName => ({
      name: accName,
      trades: trades.filter(t => t.account === accName),
      execs: allOwnExecs.filter(e => trades.filter(t=>t.account===accName).some(t=>t.id===e.trade_id)),
      isOwn: true,
      available_fund: Number(ownAccounts.find(a => a.name === accName)?.available_fund) || 0,
    })),
    ...mirroredAccounts.map(m=>{
      const subTrades = allMirroredTrades.filter(t => (mirroredTrades[m.subscriber_id]||[]).some(mt=>mt.id===t.id))
      const subAccounts = mirroredSubAccounts[m.subscriber_id] || []
      const subDeployed = subTrades.filter(t=>t.status==='OPEN').reduce((s,t)=>s+(Number(t.actual_investment)||Number(t.invested_capital)||0),0)
      const subTotalFund = subAccounts.reduce((s,a)=>s+(Number(a.available_fund)||0),0)
      return {
        name:(m.subscriber_name||m.subscriber_email||'').split(' ')[0]+"'s",
        trades: subTrades,
        execs: allMirroredExecs.filter(e => (mirroredTrades[m.subscriber_id]||[]).some(mt=>mt.id===e.trade_id)),
        isOwn: false,
        available_fund: subTotalFund - subDeployed,
      }
    }),
    ...allSubscribers
      .filter(s => !mirroredAccounts.some(m => m.subscriber_id === s.id) && s.id !== ownUserId)
      .map(s => {
        const subTrades = mirroredTrades[s.id] || []
        const subExecs = mirroredExecs[s.id] || []
        const subAccounts = mirroredSubAccounts[s.id] || []
        const subDeployed = subTrades.filter(t=>t.status==='OPEN').reduce((acc,t)=>acc+(Number(t.actual_investment)||Number(t.invested_capital)||0),0)
        const subTotalFund = subAccounts.reduce((acc,a)=>acc+(Number(a.available_fund)||0),0)
        return {
          name: s.name + "'s",
          trades: subTrades,
          execs: subExecs,
          isOwn: false,
          isFetched: false,
          available_fund: subTotalFund - subDeployed,
        }
      })
  ] : []

  const breakdownRows = useMemo(() =>
    subscriberBreakdown.map(({ name, trades: t, execs: e, isOwn, isFetched = true, available_fund }) => {
      const deployed = t.filter(x => x.status === 'OPEN').reduce((s, x) => s + (Number(x.actual_investment) || Number(x.invested_capital) || 0), 0)
      return {
        name, isOwn, isFetched,
        _open: t.filter(x => x.status === 'OPEN').length,
        _closed: t.filter(x => x.status === 'CLOSED').length,
        _unr: calcUnrealised(t, e),
        _rel: calcRealised(t, e),
        _mtf: calcMTF(t),
        _avail: available_fund - deployed,
      }
    }), [subscriberBreakdown]) // eslint-disable-line react-hooks/exhaustive-deps

  const bdColumns = useMemo(() => [
    { key: 'name', label: 'Account', filterable: true, sortable: true },
    { key: '_open', label: 'Open', sortable: true },
    { key: '_closed', label: 'Closed', sortable: true },
    { key: '_unr', label: 'Unreal. P&L', sortable: true },
    { key: '_rel', label: 'Real. P&L', sortable: true },
    { key: '_mtf', label: 'MTF Int', sortable: true },
    { key: '_avail', label: 'Avail. Fund', sortable: true },
  ], [])

  const bd = useTableFilter(breakdownRows, bdColumns)

  // ── PERFORMANCE METRICS ──
  const perfMetrics = useMemo(() => {
    const closedAll = tradesWithRealised.filter(t => t.status === 'CLOSED')
    const getRealisedPnL = (t) => {
      const te = allExecs.filter(e => e.trade_id === t.id)
      if (te.length > 0) return te.reduce((s, e) => s + (Number(e.price) - Number(t.entry_price)) * Number(e.quantity), 0)
      if (t.exit_price) return (Number(t.exit_price) - Number(t.entry_price)) * Number(t.quantity)
      return 0
    }
    const tradePnLs = closedAll.map(t => ({ ...t, _pnl: getRealisedPnL(t) }))
    const winT = tradePnLs.filter(t => t._pnl > 0)
    const lossT = tradePnLs.filter(t => t._pnl <= 0)

    const bestTrade = tradePnLs.length > 0 ? Math.max(...tradePnLs.map(t => t._pnl)) : 0
    const worstTrade = tradePnLs.length > 0 ? Math.min(...tradePnLs.map(t => t._pnl)) : 0
    const avgWin = winT.length > 0 ? winT.reduce((s, t) => s + t._pnl, 0) / winT.length : 0
    const avgLoss = lossT.length > 0 ? lossT.reduce((s, t) => s + t._pnl, 0) / lossT.length : 0

    const grossProfit = winT.reduce((s, t) => s + t._pnl, 0)
    const grossLoss = Math.abs(lossT.reduce((s, t) => s + t._pnl, 0))
    const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0
    const payoffRatio = Math.abs(avgLoss) > 0 ? avgWin / Math.abs(avgLoss) : 0
    const breakevenWR = payoffRatio > 0 ? (1 / (1 + payoffRatio)) * 100 : 0

    const winPct = tradePnLs.length > 0 ? winT.length / tradePnLs.length : 0
    const expectancy = (winPct * avgWin) + ((1 - winPct) * avgLoss)

    // Holding durations
    const holdMs = (t) => { if (!t.entry_date || !t.exit_date) return null; const ms = new Date(t.exit_date) - new Date(t.entry_date); return ms >= 0 ? ms : null }
    const winHMs = winT.map(holdMs).filter(x => x !== null)
    const lossHMs = lossT.map(holdMs).filter(x => x !== null)
    const allHMs = tradePnLs.map(holdMs).filter(x => x !== null)
    const avgWinHold = winHMs.length > 0 ? winHMs.reduce((s, x) => s + x, 0) / winHMs.length : 0
    const avgLossHold = lossHMs.length > 0 ? lossHMs.reduce((s, x) => s + x, 0) / lossHMs.length : 0
    const avgAllHold = allHMs.length > 0 ? allHMs.reduce((s, x) => s + x, 0) / allHMs.length : 0
    const fmtDur = (ms) => {
      if (!ms) return '—'
      const d = Math.floor(ms / 86400000), h = Math.floor((ms % 86400000) / 3600000), m = Math.floor((ms % 3600000) / 60000)
      if (d > 0) return `${d}d ${h}h ${m}m`
      if (h > 0) return `${h}h ${m}m`
      return `${m}m`
    }

    // Best / Worst day P&L
    const dPnL = {}
    allExecs.forEach(exec => {
      const trade = allTrades.find(t => t.id === exec.trade_id); if (!trade) return
      const dt = (exec.date || exec.created_at || '').split('T')[0]; if (!dt) return
      dPnL[dt] = (dPnL[dt] || 0) + (Number(exec.price) - Number(trade.entry_price)) * Number(exec.quantity)
    })
    closedAll.forEach(t => {
      if (!t.exit_date || !t.exit_price || allExecs.some(e => e.trade_id === t.id)) return
      const dt = t.exit_date.split('T')[0]
      dPnL[dt] = (dPnL[dt] || 0) + (Number(t.exit_price) - Number(t.entry_price)) * Number(t.quantity)
    })
    const dVals = Object.values(dPnL)
    const bestDay = dVals.length > 0 ? Math.max(...dVals) : 0
    const worstDay = dVals.length > 0 ? Math.min(...dVals) : 0

    // Consecutive wins/losses + current streak
    const sorted = [...tradePnLs].sort((a, b) => new Date(a.exit_date || a.updated_at) - new Date(b.exit_date || b.updated_at))
    let maxCW = 0, maxCL = 0, cw = 0, cl = 0
    sorted.forEach(t => { if (t._pnl > 0) { cw++; cl = 0; maxCW = Math.max(maxCW, cw) } else { cl++; cw = 0; maxCL = Math.max(maxCL, cl) } })
    let streak = 0, sType = null
    for (let i = sorted.length - 1; i >= 0; i--) {
      const w = sorted[i]._pnl > 0
      if (sType === null) { sType = w ? 'W' : 'L'; streak = 1 }
      else if ((w && sType === 'W') || (!w && sType === 'L')) streak++
      else break
    }

    // Max Drawdown (equity curve peak to trough)
    let peak = 0, maxDD = 0, cum = 0
    sorted.forEach(t => { cum += t._pnl; if (cum > peak) peak = cum; maxDD = Math.max(maxDD, peak - cum) })

    // R-Multiple (only trades with stop_loss set)
    const withSL = tradePnLs.filter(t => t.stop_loss && Number(t.stop_loss) > 0 && Number(t.stop_loss) !== Number(t.entry_price))
    const rMults = withSL.map(t => { const risk = Math.abs(Number(t.entry_price) - Number(t.stop_loss)); return risk > 0 ? t._pnl / (risk * Number(t.quantity)) : null }).filter(x => x !== null)
    const avgR = rMults.length > 0 ? rMults.reduce((s, x) => s + x, 0) / rMults.length : null

    return {
      winCount: winT.length, lossCount: lossT.length,
      winRatePct: tradePnLs.length > 0 ? (winT.length / tradePnLs.length * 100) : 0,
      bestTrade, worstTrade, avgWin, avgLoss,
      profitFactor, payoffRatio, breakevenWR, expectancy,
      bestDay, worstDay,
      avgWinHold, avgLossHold, avgAllHold, fmtDur,
      maxConsWins: maxCW, maxConsLosses: maxCL,
      currentStreak: streak, streakType: sType,
      maxDrawdown: maxDD,
      avgRMultiple: avgR, slCount: withSL.length, totalClosed: tradePnLs.length,
    }
  }, [tradesWithRealised, allExecs, allTrades]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!session) return null

  return (
    <>
      <div className="tricolor-bar" />
      <Head><title>Dashboard — SMK Stock Journal</title></Head>
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
              <StatCard label="Fund Deployed" value={`Rs.${fmtINR(fundDeployed)}`} color="var(--accent)" sub={`across ${openTrades.length} open trades`} />
              <StatCard label="MTF Interest" value={`Rs.${fmtINR(totalMTF)}`} color="var(--gold)" sub="Accrued" />
              <StatCard label="Total Trades" value={allTrades.length} sub={`${openTrades.length} open · ${closedTrades.length} closed`} />
            </div>

            {/* ADMIN: per-account breakdown */}
            {isAdmin && subscriberBreakdown.length>1 && (
              <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'8px', padding:'20px', marginBottom:'20px' }}>
                <div style={{ fontFamily:'Bookman Old Style, serif', fontWeight:700, fontSize:'13px', color:'var(--text)', marginBottom:'14px', display:'flex', alignItems:'center', gap:'10px' }}>
                  Account Breakdown
                  {selectedAccounts.size > 0 && (
                    <button onClick={() => setSelectedAccounts(new Set())}
                      style={{ fontSize:'10px', padding:'2px 10px', borderRadius:'4px', border:'1px solid var(--accent)', background:'var(--accent-dim)', color:'var(--accent)', cursor:'pointer', fontFamily:'DM Mono, monospace', fontWeight:600 }}>
                      Clear ({selectedAccounts.size})
                    </button>
                  )}
                </div>
                <table className="data-table">
                    <colgroup>
                      <col style={{ width:'4%' }} />
                      <col style={{ width:'18%' }} />
                      <col style={{ width:'7%' }} />
                      <col style={{ width:'7%' }} />
                      <col style={{ width:'16%' }} />
                      <col style={{ width:'16%' }} />
                      <col style={{ width:'16%' }} />
                      <col style={{ width:'16%' }} />
                    </colgroup>
                    <thead>
                      <tr>
                        <th style={{ padding:'8px 4px', textAlign:'center' }}>
                          {selectedAccounts.size > 0 && (
                            <span onClick={() => setSelectedAccounts(new Set())}
                              style={{ cursor:'pointer', fontSize:'10px', color:'var(--accent)', fontFamily:'DM Mono, monospace' }}>✕</span>
                          )}
                        </th>
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
                      {(() => {
                        const selected = bd.filteredData.filter(r => selectedAccounts.has(r.name))
                        const unselected = bd.filteredData.filter(r => !selectedAccounts.has(r.name))
                        const renderRow = (row) => {
                          const { name, isOwn, isFetched = true, _open, _closed, _unr, _rel, _mtf, _avail } = row
                          const isSel = selectedAccounts.has(name)
                          return (
                            <tr key={name} style={{ borderBottom:'1px solid var(--border)', background: isSel ? 'var(--accent-dim)' : 'transparent' }}>
                              <td style={{ padding:'8px 4px', textAlign:'center' }}>
                                <input type="checkbox" checked={isSel} onChange={() => toggleAccount(name)}
                                  style={{ cursor:'pointer', accentColor:'var(--accent)' }} />
                              </td>
                              <td style={{ padding:'8px 12px', fontFamily:'DM Mono, monospace', color:'var(--text)' }}>
                                <span style={{ fontWeight:700 }}>{name}</span>
                                {isOwn && <span style={{ marginLeft:'6px', fontSize:'8px', background:'var(--accent-dim)', color:'var(--accent)', padding:'1px 5px', borderRadius:'3px', fontWeight:600 }}>MINE</span>}
                                {!isOwn && isFetched && <span style={{ marginLeft:'6px', fontSize:'8px', background:'rgba(245,158,11,0.1)', color:'var(--gold)', padding:'1px 5px', borderRadius:'3px', fontWeight:600 }}>MIRRORED</span>}
                              </td>
                              <td style={{ padding:'8px 12px', textAlign:'right', color:'var(--accent)', fontFamily:'DM Mono, monospace' }}>{_open}</td>
                              <td style={{ padding:'8px 12px', textAlign:'right', color:'var(--muted)', fontFamily:'DM Mono, monospace' }}>{_closed}</td>
                              <td style={{ padding:'8px 12px', textAlign:'right', fontWeight:700, fontFamily:'DM Mono, monospace', color:_unr>=0?'var(--bull)':'var(--bear)' }}>{_unr>=0?'+':'−'}Rs.{toINR(Math.abs(_unr))}</td>
                              <td style={{ padding:'8px 12px', textAlign:'right', fontWeight:700, fontFamily:'DM Mono, monospace', color:_rel>=0?'var(--bull)':'var(--bear)' }}>{_rel>=0?'+':'−'}Rs.{toINR(Math.abs(_rel))}</td>
                              <td style={{ padding:'8px 12px', textAlign:'right', color:'var(--gold)', fontFamily:'DM Mono, monospace' }}>Rs.{toINRd(_mtf)}</td>
                              <td style={{ padding:'8px 12px', textAlign:'right', fontFamily:'DM Mono, monospace', fontWeight:600, color: _avail >= 0 ? 'var(--bull)' : 'var(--bear)' }}>
                                Rs.{toINR(Math.abs(_avail))}
                              </td>
                            </tr>
                          )
                        }

                        if (selectedAccounts.size === 0) {
                          const adminRows = bd.filteredData.filter(r => r.isOwn || r.isFetched !== false)
                          const unfetchedRows = bd.filteredData.filter(r => r.isFetched === false)
                          return (
                            <>
                              {adminRows.length > 0 && (
                                <>
                                  <tr>
                                    <td colSpan={8} style={{ padding:'6px 12px', background:'rgba(14,165,233,0.06)', borderTop:'2px solid var(--accent)', borderBottom:'1px solid var(--accent)' }}>
                                      <span style={{ fontFamily:'Bookman Old Style, serif', fontWeight:700, fontSize:'11px', color:'var(--accent)', letterSpacing:'0.08em' }}>ADMIN'S ACCOUNTS</span>
                                    </td>
                                  </tr>
                                  {adminRows.map(renderRow)}
                                </>
                              )}
                              {unfetchedRows.length > 0 && (
                                <>
                                  <tr>
                                    <td colSpan={8} style={{ padding:'6px 12px', background:'rgba(245,158,11,0.06)', borderTop:'2px solid var(--gold)', borderBottom:'1px solid var(--gold)' }}>
                                      <span style={{ fontFamily:'Bookman Old Style, serif', fontWeight:700, fontSize:'11px', color:'var(--gold)', letterSpacing:'0.08em' }}>SUBSCRIBER'S ACCOUNTS</span>
                                    </td>
                                  </tr>
                                  {unfetchedRows.map(renderRow)}
                                </>
                              )}
                            </>
                          )
                        }

                        const totOpen = selected.reduce((s, r) => s + r._open, 0)
                        const totClosed = selected.reduce((s, r) => s + r._closed, 0)
                        const totUnr = selected.reduce((s, r) => s + r._unr, 0)
                        const totRel = selected.reduce((s, r) => s + r._rel, 0)
                        const totMtf = selected.reduce((s, r) => s + r._mtf, 0)
                        const totAvail = selected.filter(r => r._avail !== null).reduce((s, r) => s + r._avail, 0)

                        const adminRows = bd.filteredData.filter(r => r.isOwn || r.isFetched !== false)
                        const unfetchedRows = bd.filteredData.filter(r => r.isFetched === false)
                        return (
                          <>
                            <tr>
                              <td colSpan={8} style={{ padding:'6px 12px', background:'rgba(14,165,233,0.06)', borderTop:'2px solid var(--accent)', borderBottom:'1px solid var(--accent)' }}>
                                <span style={{ fontFamily:'Bookman Old Style, serif', fontWeight:700, fontSize:'11px', color:'var(--accent)', letterSpacing:'0.08em' }}>ADMIN'S ACCOUNTS</span>
                              </td>
                            </tr>
                            {adminRows.map(renderRow)}
                            {selected.length > 0 && (
                              <tr style={{ borderTop:'2px solid var(--accent)', background:'var(--accent-dim)' }}>
                                <td style={{ padding:'10px 4px', textAlign:'center' }}>
                                  <span style={{ fontSize:'12px', fontWeight:800, color:'var(--accent)', fontFamily:'DM Mono, monospace' }}>Σ</span>
                                </td>
                                <td style={{ padding:'10px 12px', fontFamily:'DM Mono, monospace', fontWeight:800, color:'var(--accent)', fontSize:'14px' }}>
                                  Selected Total ({selected.length})
                                </td>
                                <td style={{ padding:'10px 12px', textAlign:'right', color:'var(--accent)', fontFamily:'DM Mono, monospace', fontWeight:800, fontSize:'14px' }}>{totOpen}</td>
                                <td style={{ padding:'10px 12px', textAlign:'right', color:'var(--muted)', fontFamily:'DM Mono, monospace', fontWeight:800, fontSize:'14px' }}>{totClosed}</td>
                                <td style={{ padding:'10px 12px', textAlign:'right', fontWeight:800, fontFamily:'DM Mono, monospace', fontSize:'14px', color:totUnr>=0?'var(--bull)':'var(--bear)' }}>{totUnr>=0?'+':'−'}Rs.{toINR(Math.abs(totUnr))}</td>
                                <td style={{ padding:'10px 12px', textAlign:'right', fontWeight:800, fontFamily:'DM Mono, monospace', fontSize:'14px', color:totRel>=0?'var(--bull)':'var(--bear)' }}>{totRel>=0?'+':'−'}Rs.{toINR(Math.abs(totRel))}</td>
                                <td style={{ padding:'10px 12px', textAlign:'right', color:'var(--gold)', fontFamily:'DM Mono, monospace', fontWeight:800, fontSize:'14px' }}>Rs.{toINRd(totMtf)}</td>
                                <td style={{ padding:'10px 12px', textAlign:'right', fontFamily:'DM Mono, monospace', fontWeight:800, fontSize:'14px', color: totAvail >= 0 ? 'var(--bull)' : 'var(--bear)' }}>Rs.{toINR(Math.abs(totAvail))}</td>
                              </tr>
                            )}
                            {unfetchedRows.length > 0 && (
                              <>
                                <tr>
                                  <td colSpan={8} style={{ padding:'6px 12px', background:'rgba(245,158,11,0.06)', borderTop:'2px solid var(--gold)', borderBottom:'1px solid var(--gold)' }}>
                                    <span style={{ fontFamily:'Bookman Old Style, serif', fontWeight:700, fontSize:'11px', color:'var(--gold)', letterSpacing:'0.08em' }}>SUBSCRIBER'S ACCOUNTS</span>
                                  </td>
                                </tr>
                                {unfetchedRows.map(renderRow)}
                              </>
                            )}
                          </>
                        )
                      })()}
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

            {/* CALENDAR + RECENT EXITS */}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 320px', gap:'16px', marginBottom:'20px' }}>
              <PnLCalendar trades={tradesWithRealised} allExecs={allExecs} resultAnnouncements={resultAnnouncements} />
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

            {/* OPEN POSITIONS TABLE */}
            {openTrades.length > 0 && (
              <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'8px', padding:'20px', marginBottom:'20px', position:'relative' }}>
                <div style={{ fontFamily:'Bookman Old Style, serif', fontWeight:700, fontSize:'13px', color:'var(--text)', marginBottom:'14px' }}>
                  Open Positions
                  <span style={{ marginLeft:'10px', fontSize:'10px', background:'var(--accent-dim)', color:'var(--accent)', padding:'2px 8px', borderRadius:'4px', fontFamily:'DM Mono, monospace' }}>{openPositions.length} tickers · {openTrades.length} trades</span>
                </div>
                <table className="data-table">
                  <thead>
                    <tr>
                      {opColumns.map(col => (
                        <th key={col.key}
                          className={col.key !== 'ticker' ? 'r' : undefined}
                          style={{ cursor: col.sortable ? 'pointer' : 'default' }}
                          onClick={() => col.sortable && op.handleSort(col.key)}>
                          <div className="col-header" style={col.key !== 'ticker' ? { justifyContent:'flex-end' } : undefined}>
                            <span>{col.label}</span>
                            {col.sortable && (
                              <span className={`sort-arrow${op.sortConfig?.key === col.key ? ' active' : ''}`}>
                                {op.sortConfig?.key === col.key ? (op.sortConfig.direction === 'asc' ? '↑' : '↓') : '↕'}
                              </span>
                            )}
                            {col.filterable && (
                              <span className={`filter-icon${(op.columnFilters[col.key]?.size || 0) > 0 ? ' has-filter' : ''}`}
                                onClick={e => op.openFilter(e, col.key)}>▼</span>
                            )}
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {op.filteredData.map(row => (
                      <tr key={row.ticker} style={{ borderBottom:'1px solid var(--border)' }}>
                        <td style={{ padding:'8px 12px', fontFamily:'DM Mono, monospace', fontWeight:700, color:'var(--text)' }}>{row.ticker}</td>
                        <td style={{ padding:'8px 12px', textAlign:'right', fontFamily:'DM Mono, monospace', color:'var(--text)' }}>{row.currentQty.toLocaleString('en-IN')}</td>
                        <td style={{ padding:'8px 12px', textAlign:'right', fontFamily:'DM Mono, monospace', color:'var(--muted)' }}>{row.numAccounts}</td>
                        <td style={{ padding:'8px 12px', textAlign:'right' }}>
                          {row.cmp ? (
                            <div>
                              <div style={{ fontFamily:'DM Mono, monospace', fontWeight:700, color:'var(--text)', fontSize:'13px' }}>Rs.{toINRd(row.cmp)}</div>
                              {row.changePercent != null && (
                                <div style={{ fontSize:'10px', fontFamily:'DM Mono, monospace', fontWeight:700, marginTop:'2px', color: row.changePercent >= 0 ? 'var(--bull)' : 'var(--bear)' }}>
                                  {row.changePercent >= 0 ? '▲' : '▼'} {Math.abs(row.changePercent).toFixed(2)}%
                                </div>
                              )}
                            </div>
                          ) : '—'}
                        </td>
                        <td style={{ padding:'8px 12px', textAlign:'right', fontWeight:700, fontFamily:'DM Mono, monospace', color:row.unrealised>=0?'var(--bull)':'var(--bear)' }}>{row.cmp ? `${row.unrealised>=0?'+':'−'}Rs.${toINR(Math.abs(row.unrealised))}` : '—'}</td>
                        <td style={{ padding:'8px 12px', textAlign:'right', fontWeight:700, fontFamily:'DM Mono, monospace', color:row.realised>=0?'var(--bull)':'var(--bear)' }}>{row.realised !== 0 ? `${row.realised>=0?'+':'−'}Rs.${toINR(Math.abs(row.realised))}` : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                  {op.filteredData.length > 1 && (() => {
                    const totUnr = op.filteredData.reduce((s, r) => s + r.unrealised, 0)
                    const totRel = op.filteredData.reduce((s, r) => s + r.realised, 0)
                    const totQty = op.filteredData.reduce((s, r) => s + r.currentQty, 0)
                    return (
                      <tfoot>
                        <tr style={{ borderTop:'2px solid var(--border)', background:'var(--surface2)' }}>
                          <td style={{ padding:'10px 12px', fontFamily:'DM Mono, monospace', fontWeight:800, color:'var(--text)', fontSize:'12px' }}>TOTAL</td>
                          <td style={{ padding:'10px 12px', textAlign:'right', fontFamily:'DM Mono, monospace', fontWeight:800, fontSize:'12px' }}>{totQty.toLocaleString('en-IN')}</td>
                          <td></td>
                          <td></td>
                          <td style={{ padding:'10px 12px', textAlign:'right', fontWeight:800, fontFamily:'DM Mono, monospace', fontSize:'12px', color:totUnr>=0?'var(--bull)':'var(--bear)' }}>{totUnr>=0?'+':'−'}Rs.{toINR(Math.abs(totUnr))}</td>
                          <td style={{ padding:'10px 12px', textAlign:'right', fontWeight:800, fontFamily:'DM Mono, monospace', fontSize:'12px', color:totRel>=0?'var(--bull)':'var(--bear)' }}>{totRel>=0?'+':'−'}Rs.{toINR(Math.abs(totRel))}</td>
                        </tr>
                      </tfoot>
                    )
                  })()}
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

            {/* PERFORMANCE METRICS */}
            {closedTrades.length > 0 && (() => {
              const pm = perfMetrics
              const MI = ({ label, value, color, sub }) => (
                <div style={{ padding:'10px 12px', background:'var(--bg)', borderRadius:'5px', border:'1px solid var(--border)', minWidth:0 }}>
                  <div style={{ fontSize:'9px', color:'var(--muted)', letterSpacing:'0.1em', textTransform:'uppercase', marginBottom:'5px', fontFamily:'DM Mono, monospace', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{label}</div>
                  <div style={{ fontSize:'13px', fontWeight:700, fontFamily:"'DM Mono', monospace", color: color || 'var(--text)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{value}</div>
                  {sub && <div style={{ fontSize:'9px', color:'var(--muted)', marginTop:'3px', fontFamily:'DM Mono, monospace' }}>{sub}</div>}
                </div>
              )
              const bullBear = v => v >= 0 ? 'var(--bull)' : 'var(--bear)'
              const sign = v => v >= 0 ? '+' : '−'
              const rs = v => `${sign(v)}Rs.${fmtINR(Math.abs(v))}`
              return (
                <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'8px', padding:'20px' }}>
                  <div style={{ fontFamily:'Bookman Old Style, serif', fontWeight:700, fontSize:'13px', color:'var(--text)', marginBottom:'16px', display:'flex', alignItems:'center', gap:'8px' }}>
                    Performance Metrics
                    <span style={{ fontSize:'10px', background:'var(--accent-dim)', color:'var(--accent)', padding:'2px 8px', borderRadius:'4px', fontFamily:'DM Mono, monospace' }}>{pm.totalClosed} closed trades</span>
                    {pm.slCount > 0 && <span style={{ fontSize:'10px', background:'rgba(245,158,11,0.1)', color:'var(--gold)', padding:'2px 8px', borderRadius:'4px', fontFamily:'DM Mono, monospace' }}>{pm.slCount}/{pm.totalClosed} with SL</span>}
                  </div>

                  {/* Row 1: Trade P&L */}
                  <div style={{ fontSize:'10px', color:'var(--muted)', fontFamily:'DM Mono, monospace', letterSpacing:'0.1em', textTransform:'uppercase', marginBottom:'8px', marginTop:'4px' }}>Trade P&L</div>
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(140px, 1fr))', gap:'8px', marginBottom:'16px' }}>
                    <MI label="Best Trade" value={rs(pm.bestTrade)} color="var(--bull)" />
                    <MI label="Worst Trade" value={rs(pm.worstTrade)} color="var(--bear)" />
                    <MI label="Avg Winning Trade" value={rs(pm.avgWin)} color="var(--bull)" sub={`${pm.winCount} wins`} />
                    <MI label="Avg Losing Trade" value={rs(pm.avgLoss)} color="var(--bear)" sub={`${pm.lossCount} losses`} />
                    <MI label="Expectancy" value={rs(pm.expectancy)} color={bullBear(pm.expectancy)} sub="per trade avg" />
                  </div>

                  {/* Row 2: Ratios */}
                  <div style={{ fontSize:'10px', color:'var(--muted)', fontFamily:'DM Mono, monospace', letterSpacing:'0.1em', textTransform:'uppercase', marginBottom:'8px' }}>Ratios & Edge</div>
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(140px, 1fr))', gap:'8px', marginBottom:'16px' }}>
                    <MI label="Win Rate" value={`${pm.winRatePct.toFixed(1)}%`} color="var(--accent)" sub={`${pm.winCount}W · ${pm.lossCount}L`} />
                    <MI label="Profit Factor" value={pm.profitFactor === Infinity ? '∞' : pm.profitFactor.toFixed(2)} color={pm.profitFactor >= 1 ? 'var(--bull)' : 'var(--bear)'} sub="gross profit / loss" />
                    <MI label="Payoff Ratio" value={`1 : ${pm.payoffRatio.toFixed(2)}`} sub="avg win / avg loss" />
                    <MI label="Breakeven Win Rate" value={`${pm.breakevenWR.toFixed(1)}%`} color="var(--muted)" sub={`edge: ${(pm.winRatePct - pm.breakevenWR).toFixed(1)}%`} />
                    {pm.avgRMultiple !== null && (
                      <MI label="Avg R-Multiple" value={`${pm.avgRMultiple >= 0 ? '+' : ''}${pm.avgRMultiple.toFixed(2)}R`} color={bullBear(pm.avgRMultiple)} sub={`${pm.slCount} of ${pm.totalClosed} with SL`} />
                    )}
                  </div>

                  {/* Row 3: Risk */}
                  <div style={{ fontSize:'10px', color:'var(--muted)', fontFamily:'DM Mono, monospace', letterSpacing:'0.1em', textTransform:'uppercase', marginBottom:'8px' }}>Risk & Streaks</div>
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(140px, 1fr))', gap:'8px', marginBottom:'16px' }}>
                    <MI label="Max Drawdown" value={pm.maxDrawdown > 0 ? `−Rs.${fmtINR(pm.maxDrawdown)}` : '—'} color="var(--bear)" sub="peak to trough" />
                    <MI label="Largest Winning Day" value={pm.bestDay > 0 ? rs(pm.bestDay) : '—'} color="var(--bull)" />
                    <MI label="Largest Losing Day" value={pm.worstDay < 0 ? rs(pm.worstDay) : '—'} color="var(--bear)" />
                    <MI label="Max Consec. Wins" value={pm.maxConsWins} color="var(--bull)" />
                    <MI label="Max Consec. Losses" value={pm.maxConsLosses} color="var(--bear)" />
                    <MI label="Current Streak" value={pm.streakType ? `${pm.currentStreak}${pm.streakType}` : '—'} color={pm.streakType === 'W' ? 'var(--bull)' : pm.streakType === 'L' ? 'var(--bear)' : 'var(--muted)'} />
                  </div>

                  {/* Row 4: Timing */}
                  <div style={{ fontSize:'10px', color:'var(--muted)', fontFamily:'DM Mono, monospace', letterSpacing:'0.1em', textTransform:'uppercase', marginBottom:'8px' }}>Holding Duration</div>
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(140px, 1fr))', gap:'8px' }}>
                    <MI label="Avg Hold (Winners)" value={pm.fmtDur(pm.avgWinHold)} color="var(--bull)" sub={`${pm.winCount} trades`} />
                    <MI label="Avg Hold (Losers)" value={pm.fmtDur(pm.avgLossHold)} color="var(--bear)" sub={`${pm.lossCount} trades`} />
                    <MI label="Avg Time in Trade" value={pm.fmtDur(pm.avgAllHold)} sub="all closed trades" />
                  </div>
                </div>
              )
            })()}
          </>
        )}
      </main>
    </>
  )
}
