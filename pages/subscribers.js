import React, { useState, useEffect } from 'react'
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
    { label:'Alerts', path:'/alerts' },
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

function toINR(n) { return Number(n).toLocaleString('en-IN', { maximumFractionDigits:0 }) }
function toINRd(n) { return Number(n).toLocaleString('en-IN', { minimumFractionDigits:2, maximumFractionDigits:2 }) }

export default function SubscribersPage() {
  const router = useRouter()
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [subscribers, setSubscribers] = useState([])
  const [selected, setSelected] = useState(null)
  const [subTrades, setSubTrades] = useState([])
  const [subExecs, setSubExecs] = useState([])
  const [subLoading, setSubLoading] = useState(false)
  const [livePrices, setLivePrices] = useState({})
  const [mirrored, setMirrored] = useState({}) // subscriber_id -> true
  const [accountFilter, setAccountFilter] = useState('ALL')
  const [statusFilter, setStatusFilter] = useState('ALL')

  useEffect(() => {
    supabase.auth.getSession().then(({ data:{ session } }) => {
      setSession(session)
      if (!session) { router.push('/'); return }
      if (session.user.email !== ADMIN_EMAIL) { router.push('/accounts'); return }
      loadSubscribers(session)
      loadMirrored(session)
    })
    const { data:{ subscription } } = supabase.auth.onAuthStateChange((_,s) => {
      setSession(s)
      if (!s) router.push('/')
    })
    return () => subscription.unsubscribe()
  }, [])

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
            🚪\u00a0 Sign Out
          </button>
        </div>
      )}
    </div>
  )

  useEffect(() => { if (session?.user?.email === ADMIN_EMAIL) loadSubscribers(session) }, [session])

  const getToken = async () => (await supabase.auth.getSession()).data.session?.access_token

  const loadMirrored = async (sess) => {
    const token = sess?.access_token || (await supabase.auth.getSession()).data.session?.access_token
    if (!token) return
    const res = await fetch('/api/admin/mirror', { headers:{ Authorization:`Bearer ${token}` } })
    const data = await res.json()
    if (Array.isArray(data)) {
      const map = {}
      data.forEach(m => { map[m.subscriber_id] = true })
      setMirrored(map)
    }
  }

  const toggleMirror = async (sub) => {
    const token = session?.access_token || (await supabase.auth.getSession()).data.session?.access_token
    if (!token) return
    const isMirrored = mirrored[sub.id]
    if (isMirrored) {
      await fetch('/api/admin/mirror', { method:'DELETE', headers:{ 'Content-Type':'application/json', Authorization:`Bearer ${token}` }, body: JSON.stringify({ subscriber_id: sub.id }) })
      setMirrored(prev => { const n = {...prev}; delete n[sub.id]; return n })
    } else {
      await fetch('/api/admin/mirror', { method:'POST', headers:{ 'Content-Type':'application/json', Authorization:`Bearer ${token}` }, body: JSON.stringify({ subscriber_id: sub.id, subscriber_name: sub.full_name || sub.email, subscriber_email: sub.email }) })
      setMirrored(prev => ({ ...prev, [sub.id]: true }))
    }
  }

  const loadSubscribers = async (sess) => {
    setLoading(true)
    const token = sess?.access_token || (await supabase.auth.getSession()).data.session?.access_token
    if (!token) { setLoading(false); return }
    const res = await fetch('/api/admin/subscribers', { headers:{ Authorization:`Bearer ${token}` } })
    const data = await res.json()
    if (data.error) {
      console.error('Subscribers API error:', data)
      alert('API Error: ' + JSON.stringify(data))
    }
    if (Array.isArray(data)) setSubscribers(data)
    setLoading(false)
  }

  const loadSubscriberTrades = async (sub) => {
    setSelected(sub)
    setSubLoading(true)
    setSubTrades([]); setSubExecs([]); setLivePrices({}); setAccountFilter('ALL'); setStatusFilter('ALL')
    try {
      const token = session?.access_token || (await supabase.auth.getSession()).data.session?.access_token
      if (!token) { setSubLoading(false); return }
      const res = await fetch(`/api/admin/subscriber-trades?user_id=${sub.id}`, { headers:{ Authorization:`Bearer ${token}` } })
      const text = await res.text()
      let data
      try { data = JSON.parse(text) } catch { console.error('Parse error:', text); setSubLoading(false); return }
      if (data.error) { console.error('API error:', data); setSubLoading(false); return }
      setSubTrades(data.trades || [])
      setSubExecs(data.executions || [])
      const tickers = [...new Set((data.trades||[]).filter(t=>t.status==='OPEN').map(t=>t.ticker))]
      tickers.forEach(async ticker => {
        try {
          const r = await fetch(`/api/stock/${ticker}`)
          const d = await r.json()
          if (d.price) setLivePrices(prev => ({ ...prev, [ticker]: d }))
        } catch {}
      })
    } catch(e) { console.error('loadSubscriberTrades error:', e) }
    setSubLoading(false)
  }

  const pnlColor = (n) => n >= 0 ? 'var(--bull)' : 'var(--bear)'
  const pnlSign = (n) => n >= 0 ? '+' : '−'

  // Accounts of selected subscriber
  const accounts = [...new Set(subTrades.map(t => t.account).filter(Boolean))]
  const accountFiltered = accountFilter === 'ALL' ? subTrades : subTrades.filter(t => t.account === accountFilter)
  const filtered = statusFilter === 'ALL' ? accountFiltered : accountFiltered.filter(t => t.status === statusFilter)

  return (
    <>
      <Head><title>Subscribers — CHiiRAG Journal</title></Head>
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
        <NavPill active="Subscribers" isAdmin={true} />
        <div style={{ display:'flex', alignItems:'center', gap:'12px' }}>
          <span style={{ fontSize:'11px', color:'var(--muted)', fontFamily:'DM Mono, monospace' }}>ADMIN</span>
          <ExitMenu />
        </div>
      </header>

      <main style={{ paddingTop:'80px', maxWidth:'1400px', margin:'0 auto', padding:'80px 24px 40px' }}>

        {/* Subscriber Summary Table */}
        <div style={{ marginBottom:'32px' }}>
          <div style={{ display:'flex', alignItems:'center', gap:'12px', marginBottom:'16px' }}>
            <h2 style={{ fontFamily:'Bookman Old Style, serif', fontSize:'20px', fontWeight:700, color:'var(--text)', margin:0 }}>
              Subscribers
            </h2>
            <span style={{ fontSize:'11px', color:'var(--muted)', background:'var(--surface)', padding:'2px 10px', borderRadius:'20px', fontFamily:'DM Mono, monospace' }}>
              {subscribers.length} users
            </span>
          </div>

          {loading ? (
            <div style={{ color:'var(--muted)', fontSize:'13px', padding:'20px' }}>Loading subscribers...</div>
          ) : subscribers.length === 0 ? (
            <div style={{ color:'var(--muted)', fontSize:'13px', padding:'20px' }}>No subscribers yet. Share your URL with family and friends!</div>
          ) : (
            <div className="table-container" style={{ overflowX:"auto", borderRadius:"8px", border:"1px solid var(--border)", marginBottom:"8px" }}>
              <table className="trade-table">
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Email</th>
                    <th className="right">Total Trades</th>
                    <th className="right">Open</th>
                    <th className="right">Closed</th>
                    <th className="right">Total Investment</th>
                    <th className="right">Realised P&L</th>
                    <th className="right">Joined</th>
                    <th style={{ textAlign:'center' }}>Mirror</th>
                  </tr>
                </thead>
                <tbody>
                  {subscribers.map(sub => (
                    <tr key={sub.id}
                      onClick={() => selected?.id===sub.id ? setSelected(null) : loadSubscriberTrades(sub)}
                      style={{ background: selected?.id===sub.id ? 'rgba(14,165,233,0.08)' : '', cursor:'pointer', transition:'background 0.15s' }}
                      onMouseEnter={e => { if (selected?.id!==sub.id) e.currentTarget.style.background='rgba(14,165,233,0.04)' }}
                      onMouseLeave={e => { if (selected?.id!==sub.id) e.currentTarget.style.background='' }}>
                      <td>
                        <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                          <span style={{ fontSize:'10px', color:'var(--accent)', width:'10px', flexShrink:0 }}>{selected?.id===sub.id ? '▼' : '▶'}</span>
                          {sub.avatar_url
                            ? <img src={sub.avatar_url} alt="" style={{ width:'28px', height:'28px', borderRadius:'50%', border:'1px solid var(--border)' }} />
                            : <div style={{ width:'28px', height:'28px', borderRadius:'50%', background:'var(--accent)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'12px', color:'#fff', fontWeight:700 }}>{(sub.full_name||sub.email||'?')[0].toUpperCase()}</div>
                          }
                          <span style={{ fontWeight:600, fontSize:'13px' }}>{sub.full_name || '—'}</span>
                          {sub.isAdmin && <span style={{ fontSize:'9px', background:'var(--gold)', color:'#000', padding:'1px 6px', borderRadius:'4px', fontFamily:'DM Mono, monospace', fontWeight:700, letterSpacing:'0.08em' }}>ADMIN</span>}
                        </div>
                      </td>
                      <td className="muted" style={{ fontSize:'11px', fontFamily:'DM Mono, monospace' }}>{sub.email}</td>
                      <td className="right">{sub.totalTrades}</td>
                      <td className="right"><span style={{ color:'var(--bull)', fontWeight:600 }}>{sub.openTrades}</span></td>
                      <td className="right"><span style={{ color:'var(--muted)' }}>{sub.closedTrades}</span></td>
                      <td className="right">{sub.totalInvestment ? `Rs ${toINR(sub.totalInvestment)}` : '—'}</td>
                      <td className="right">
                        {sub.realisedPnL !== 0
                          ? <span style={{ color:pnlColor(sub.realisedPnL), fontWeight:600 }}>{pnlSign(sub.realisedPnL)}Rs {toINRd(Math.abs(sub.realisedPnL))}</span>
                          : <span className="neutral">—</span>}
                      </td>
                      <td className="right muted" style={{ fontSize:'11px' }}>{sub.created_at?.slice(0,10)}</td>
                      <td style={{ textAlign:'center' }} onClick={e => e.stopPropagation()}>
                        {sub.isAdmin ? <span className="neutral" style={{ fontSize:'11px' }}>—</span> : (
                          <button onClick={() => toggleMirror(sub)} className="btn btn-ghost" style={{ fontSize:'11px', padding:'4px 14px', color: mirrored[sub.id] ? 'var(--bear)' : 'var(--bull)', borderColor: mirrored[sub.id] ? 'var(--bear)' : 'var(--bull)', fontWeight:700 }}>
                            {mirrored[sub.id] ? '× Unlink' : '+ Fetch'}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Selected Subscriber's Portfolio */}
        {selected && (
          <div style={{ borderTop:'2px solid var(--accent)', paddingTop:'24px' }}>
            <div style={{ display:'flex', alignItems:'center', gap:'16px', marginBottom:'16px', flexWrap:'wrap' }}>
              <h3 style={{ fontFamily:'Bookman Old Style, serif', fontSize:'18px', fontWeight:700, margin:0 }}>
                {selected.full_name || selected.email}'s Portfolio
              </h3>
              <button onClick={() => setSelected(null)} style={{ background:'none', border:'none', color:'var(--muted)', cursor:'pointer', fontSize:'18px' }}>×</button>

              {/* Filter tabs — Status + Account */}
              <div style={{ display:'flex', gap:'8px', marginLeft:'auto', flexWrap:'wrap', alignItems:'center' }}>
                {/* Status filter */}
                <div style={{ display:'flex', gap:'4px' }}>
                  {['ALL','OPEN','CLOSED'].map(f => (
                    <button key={f} onClick={() => setStatusFilter(f)} style={{
                      padding:'4px 12px', borderRadius:'4px', cursor:'pointer', fontSize:'10px', fontFamily:'DM Mono, monospace', fontWeight:600,
                      border:`1px solid ${statusFilter===f?'var(--accent)':'var(--border)'}`,
                      background: statusFilter===f ? 'var(--accent-dim)' : 'transparent',
                      color: statusFilter===f ? 'var(--accent)' : 'var(--muted)'
                    }}>
                      {f} ({f==='ALL'?accountFiltered.length:accountFiltered.filter(t=>t.status===f).length})
                    </button>
                  ))}
                </div>
                {/* Account filter */}
                {accounts.length > 1 && (
                  <div style={{ display:'flex', gap:'4px', borderLeft:'1px solid var(--border)', paddingLeft:'8px' }}>
                    {['ALL', ...accounts].map(a => (
                      <button key={a} onClick={() => setAccountFilter(a)} style={{
                        padding:'4px 12px', borderRadius:'4px', cursor:'pointer', fontSize:'10px', fontFamily:'DM Mono, monospace', fontWeight:600,
                        background: accountFilter===a ? 'var(--accent)' : 'var(--surface)',
                        color: accountFilter===a ? '#fff' : 'var(--muted)',
                        border:'1px solid var(--border)'
                      }}>{a}</button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {subLoading ? (
              <div style={{ color:'var(--muted)', fontSize:'13px', padding:'20px' }}>Loading portfolio...</div>
            ) : filtered.length === 0 ? (
              <div style={{ color:'var(--muted)', fontSize:'13px', padding:'20px' }}>No trades found.</div>
            ) : (
              <div className="table-container" style={{ overflowX:"auto", borderRadius:"8px", border:"1px solid var(--border)", marginBottom:"8px" }}>
                <table className="trade-table">
                  <thead>
                    <tr>
                      <th>Ticker</th><th>Direction</th><th>Account</th><th>Entry Date</th>
                      <th className="right">Entry Rs</th><th className="right">CMP</th>
                      <th className="right">Exit Rs</th><th className="right">Qty</th>
                      <th className="right">Current Qty</th>
                      <th className="right">Investment</th>
                      <th className="right">Actual Inv</th>
                      <th className="right">MTF Interest</th>
                      <th className="right">Unrealised P&L</th>
                      <th className="right">Realised P&L</th>
                      <th className="right">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(trade => {
                      const execs = subExecs.filter(e => e.trade_id === trade.id)
                      const totalSoldQty = execs.reduce((s,e) => s + Number(e.quantity), 0)
                      const originalQty = Number(trade.quantity) || 0
                      const currentQty = Math.max(0, originalQty - totalSoldQty)
                      const entryPrice = Number(trade.entry_price) || 0
                      const investment = Number(trade.invested_capital) || 0
                      const actualInv = Number(trade.actual_investment) || 0
                      const mtfBase = investment - actualInv
                      const lp = livePrices[trade.ticker]
                      const cmp = lp?.price

                      const realisedPnL = execs.length > 0
                        ? execs.reduce((s,e) => s + (Number(e.price) - entryPrice) * Number(e.quantity), 0)
                        : (Number(trade.realized_gains) || 0)
                      const unrealisedPnL = cmp && currentQty > 0
                        ? (trade.direction==='LONG' ? (cmp-entryPrice)*currentQty : (entryPrice-cmp)*currentQty)
                        : null

                      const mtfInt = mtfBase > 0 && trade.mtf_interest_rate && trade.entry_date
                        ? execs.reduce((s,e) => {
                            const days = Math.max(1, Math.floor((new Date(e.date) - new Date(trade.entry_date)) / 86400000))
                            return s + mtfBase * (Number(e.quantity)/originalQty) * trade.mtf_interest_rate * days / 36500
                          }, 0) + (currentQty > 0
                            ? mtfBase * (currentQty/originalQty) * trade.mtf_interest_rate * Math.max(1, Math.floor((new Date() - new Date(trade.entry_date)) / 86400000)) / 36500
                            : 0)
                        : null

                      const exitPrice = currentQty === 0 && execs.length > 0
                        ? execs.reduce((s,e) => s + Number(e.price)*Number(e.quantity), 0) / totalSoldQty
                        : trade.exit_price || null

                      return (
                        <tr key={trade.id}>
                          <td><span className="ticker-badge">{trade.ticker}</span></td>
                          <td><span className={`badge badge-${trade.direction.toLowerCase()}`}>{trade.direction}</span></td>
                          <td className="muted" style={{ fontSize:'11px' }}>{trade.account || '—'}</td>
                          <td className="muted">{trade.entry_date?.slice(0,10)}</td>
                          <td className="right">Rs {toINRd(entryPrice)}</td>
                          <td className="right">
                            {cmp ? <div><div style={{ fontWeight:600 }}>Rs {toINRd(cmp)}</div><div style={{ fontSize:'10px', color:lp.change>=0?'var(--bull)':'var(--bear)' }}>{lp.change>=0?'+':''}{lp.changePercent?.toFixed(2)}%</div></div> : <span className="neutral">—</span>}
                          </td>
                          <td className="right">{exitPrice ? `Rs ${toINRd(exitPrice)}` : <span className="neutral">—</span>}</td>
                          <td className="right">{toINR(originalQty)}</td>
                          <td className="right"><span style={{ fontWeight:700, color:currentQty===0?'var(--bear)':currentQty<originalQty?'var(--gold)':'var(--text)' }}>{toINR(currentQty)}</span></td>
                          <td className="right">{investment ? `Rs ${toINRd(investment)}` : <span className="neutral">—</span>}</td>
                          <td className="right">{actualInv ? `Rs ${toINRd(actualInv)}` : <span className="neutral">—</span>}</td>
                          <td className="right">{mtfInt ? <span style={{ color:'var(--gold)' }}>Rs {toINRd(mtfInt)}</span> : <span className="neutral">—</span>}</td>
                          <td className="right">{unrealisedPnL !== null ? <span style={{ color:pnlColor(unrealisedPnL), fontWeight:600 }}>{pnlSign(unrealisedPnL)}Rs {toINRd(Math.abs(unrealisedPnL))}</span> : <span className="neutral">—</span>}</td>
                          <td className="right">{realisedPnL !== 0 || trade.status==='CLOSED' ? <span style={{ color:pnlColor(realisedPnL), fontWeight:600 }}>{pnlSign(realisedPnL)}Rs {toINRd(Math.abs(realisedPnL))}</span> : <span className="neutral">—</span>}</td>
                          <td className="right"><span style={{ fontSize:'10px', fontWeight:700, color:trade.status==='OPEN'?'var(--bull)':'var(--muted)', background:trade.status==='OPEN'?'rgba(0,230,118,0.1)':'var(--surface)', padding:'2px 8px', borderRadius:'4px' }}>{trade.status}</span></td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </main>
    </>
  )
}
