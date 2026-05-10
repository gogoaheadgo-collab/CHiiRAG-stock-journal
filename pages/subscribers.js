import React, { useState, useEffect, useMemo } from 'react'
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
function toINRd(n) { return Number(n||0).toLocaleString('en-IN', { minimumFractionDigits:2, maximumFractionDigits:2 }) }
const toINR = n => Number(n||0).toLocaleString('en-IN', { maximumFractionDigits:0 })

export default function SubscribersPage() {
  const router = useRouter()
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(false)
  const [subscribers, setSubscribers] = useState([])
  const [pendingUsers, setPendingUsers] = useState([])
  const [approving, setApproving] = useState(null)
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

  const handleApprove = async (userId, status) => {
    setApproving(userId)
    const token = await getToken()
    await fetch('/api/admin/approve-user', {
      method: 'POST',
      headers: { 'Content-Type':'application/json', Authorization:`Bearer ${token}` },
      body: JSON.stringify({ user_id: userId, status }),
    })
    setApproving(null)
    loadSubscribers(session)
  }

  const handleDeleteSubscriber = async (sub) => {
    const confirm1 = window.confirm(`⚠️ Delete ${sub.full_name || sub.email}'s account?\n\nThis will permanently erase ALL their trades, executions, accounts, and data.`)
    if (!confirm1) return
    const confirm2 = window.confirm(`🚨 FINAL WARNING\n\nYou are about to PERMANENTLY DELETE:\n• All trades for ${sub.full_name || sub.email}\n• All their accounts\n• All execution history\n\nThis CANNOT be undone. Are you absolutely sure?`)
    if (!confirm2) return
    const token = await getToken()
    const res = await fetch('/api/admin/delete-subscriber', {
      method: 'DELETE',
      headers: { 'Content-Type':'application/json', Authorization:`Bearer ${token}` },
      body: JSON.stringify({ user_id: sub.id }),
    })
    const data = await res.json()
    if (data.error) { alert('Error: ' + data.error); return }
    if (selected?.id === sub.id) setSelected(null)
    loadSubscribers(session)
  }

  const downloadCSV = () => {
    if (!selected) return
    const h=['Ticker','Account','Direction','Entry Date','Entry Price','Exit Price','Qty','Curr Qty','Realised P&L','Status']
    const rows=subTrades.map(t => {
      const exs=subExecs.filter(e=>e.trade_id===t.id)
      const sold=exs.reduce((s,e)=>s+Number(e.quantity),0)
      const orig=Number(t.quantity)||0
      const curr=Math.max(0,orig-sold)
      const entry=Number(t.entry_price)||0
      const rel=exs.length>0?exs.reduce((s,e)=>s+(Number(e.price)-entry)*Number(e.quantity),0):(Number(t.realized_gains)||0)
      return [t.ticker,t.account,t.direction,t.entry_date,entry,t.exit_price||'',orig,curr,rel.toFixed(2),t.status]
    })
    const csv=[h,...rows].map(r=>r.join(',')).join('\n')
    triggerCSVDownload(csv, `${selected.email}_trades.csv`)
  }
  const signOut = async () => { await supabase.auth.signOut(); window.location.href = '/' }

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
    // Load pending users from profiles
    const pendingRes = await fetch('/api/admin/pending-users', { headers:{ Authorization:`Bearer ${token}` } })
    const pendingData = await pendingRes.json()
    if (Array.isArray(pendingData)) setPendingUsers(pendingData)
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

  const subColumns = useMemo(() => [
    { key: 'ticker', filterable: true, sortable: true },
    { key: 'account', filterable: true, sortable: true },
    { key: 'entry_date', sortable: true },
    { key: 'entry_price', sortable: true, getSortValue: t => Number(t.entry_price) || 0 },
    { key: 'cmp', sortable: true, getSortValue: t => livePrices[t.ticker]?.price || 0 },
    { key: 'exit_price', sortable: true, getSortValue: t => Number(t.exit_price) || 0 },
    { key: 'quantity', sortable: true, getSortValue: t => Number(t.quantity) || 0 },
    { key: 'invested_capital', sortable: true, getSortValue: t => Number(t.invested_capital) || 0 },
    { key: 'mtf_int', sortable: true, getSortValue: t => {
      const exs = subExecs.filter(e => e.trade_id === t.id)
      const orig = Number(t.quantity) || 0
      const curr = Math.max(0, orig - exs.reduce((s,e) => s+Number(e.quantity), 0))
      const inv = Number(t.invested_capital) || 0
      const base = inv - (Number(t.actual_investment)||0)
      if (!base || !t.mtf_interest_rate || !t.entry_date) return 0
      return base*(curr/orig)*t.mtf_interest_rate*Math.max(1,Math.floor((new Date()-new Date(t.entry_date))/86400000))/36500
    }},
    { key: 'unrealised', sortable: true, getSortValue: t => {
      const exs = subExecs.filter(e => e.trade_id === t.id)
      const orig = Number(t.quantity) || 0
      const curr = Math.max(0, orig - exs.reduce((s,e) => s+Number(e.quantity), 0))
      const lp = livePrices[t.ticker]?.price
      if (!lp || curr === 0) return -Infinity
      const entry = Number(t.entry_price) || 0
      return t.direction === 'LONG' ? (lp-entry)*curr : (entry-lp)*curr
    }},
    { key: 'realised', sortable: true, getSortValue: t => {
      const exs = subExecs.filter(e => e.trade_id === t.id)
      const entry = Number(t.entry_price) || 0
      return exs.length > 0 ? exs.reduce((s,e) => s+(Number(e.price)-entry)*Number(e.quantity), 0) : (Number(t.realized_gains)||0)
    }},
    { key: 'status', filterable: true, sortable: true },
  ], [subExecs, livePrices])

  const subTf = useTableFilter(filtered, subColumns)

  return (
    <>
      <Head><title>Subscribers — SMK Journal</title></Head>
      <div className="tricolor-bar" />

      <Sidebar active="Subscribers" isAdmin={true} user={session?.user} onSignOut={signOut} />

      <main className="sidebar-offset" style={{ padding:'28px 32px 40px' }}>

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

          {/* ── PENDING APPROVAL — always visible if any pending ── */}
          {pendingUsers.length > 0 && (
            <div style={{ marginBottom:'20px', background:'var(--surface)', border:'2px solid var(--gold)', borderRadius:'10px', overflow:'hidden' }}>
              <div style={{ padding:'12px 16px', background:'rgba(245,158,11,0.08)', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', gap:'10px' }}>
                <span style={{ fontSize:'14px' }}>⏳</span>
                <span style={{ fontFamily:'Bookman Old Style, serif', fontWeight:700, fontSize:'14px', color:'var(--text)' }}>Pending Approval</span>
                <span style={{ fontSize:'10px', background:'var(--gold)', color:'#000', padding:'2px 8px', borderRadius:'4px', fontFamily:'DM Mono, monospace', fontWeight:700 }}>{pendingUsers.length}</span>
              </div>
              <div style={{ padding:'12px 16px', display:'flex', flexDirection:'column', gap:'8px' }}>
                {pendingUsers.map(u => (
                  <div key={u.user_id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 14px', background:'var(--bg)', border:'1px solid var(--border)', borderRadius:'8px', flexWrap:'wrap', gap:'10px' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:'12px' }}>
                      <div style={{ width:'36px', height:'36px', borderRadius:'50%', background:'var(--gold)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'14px', fontWeight:700, color:'#000' }}>
                        {(u.full_name||u.email||'?')[0].toUpperCase()}
                      </div>
                      <div>
                        <div style={{ fontFamily:'DM Mono, monospace', fontWeight:700, fontSize:'13px', color:'var(--text)' }}>{u.full_name || '—'}</div>
                        <div style={{ fontSize:'11px', color:'var(--muted)', marginTop:'2px' }}>{u.email}</div>
                        <div style={{ fontSize:'10px', color:'var(--muted)', marginTop:'1px', fontFamily:'DM Mono, monospace' }}>
                          Requested: {new Date(u.created_at).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' })}
                        </div>
                      </div>
                    </div>
                    <div style={{ display:'flex', gap:'8px' }}>
                      <button onClick={() => handleApprove(u.user_id, 'approved')} disabled={approving === u.user_id}
                        style={{ padding:'8px 18px', background:'var(--bull)', color:'#fff', border:'none', borderRadius:'6px', cursor:'pointer', fontFamily:'DM Mono, monospace', fontWeight:700, fontSize:'12px', opacity: approving === u.user_id ? 0.6 : 1 }}>
                        {approving === u.user_id ? '...' : '✓ Approve'}
                      </button>
                      <button onClick={() => handleApprove(u.user_id, 'rejected')} disabled={approving === u.user_id}
                        style={{ padding:'8px 18px', background:'none', border:'1px solid var(--bear)', color:'var(--bear)', borderRadius:'6px', cursor:'pointer', fontFamily:'DM Mono, monospace', fontWeight:700, fontSize:'12px', opacity: approving === u.user_id ? 0.6 : 1 }}>
                        ✕ Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {loading ? (
            <div style={{ color:'var(--muted)', fontSize:'13px', padding:'20px' }}>Loading subscribers...</div>
          ) : subscribers.length === 0 ? (
            <div style={{ color:'var(--muted)', fontSize:'13px', padding:'20px' }}>No subscribers yet. Share your URL with family and friends!</div>
          ) : (
            <div style={{ borderRadius:"8px", border:"1px solid var(--border)", marginBottom:"8px", overflow:"hidden" }}>
              <table className="data-table" style={{ width:'100%', tableLayout:'fixed' }}>
                <colgroup>
                  <col style={{ width:'22%' }} />
                  <col style={{ width:'20%' }} />
                  <col style={{ width:'7%' }} />
                  <col style={{ width:'6%' }} />
                  <col style={{ width:'6%' }} />
                  <col style={{ width:'12%' }} />
                  <col style={{ width:'11%' }} />
                  <col style={{ width:'9%' }} />
                  <col style={{ width:'7%' }} />
                </colgroup>
                <thead>
                  <tr>
                    <th style={{ fontSize:'10px', padding:'8px 4px', whiteSpace:'nowrap' }}>User</th>
                    <th style={{ fontSize:'10px', padding:'8px 4px', whiteSpace:'nowrap' }}>Email</th>
                    <th className="r" style={{ fontSize:'10px', padding:'8px 4px', whiteSpace:'nowrap' }}>Trades</th>
                    <th className="r" style={{ fontSize:'10px', padding:'8px 4px', whiteSpace:'nowrap' }}>Open</th>
                    <th className="r" style={{ fontSize:'10px', padding:'8px 4px', whiteSpace:'nowrap' }}>Closed</th>
                    <th className="r" style={{ fontSize:'10px', padding:'8px 4px', whiteSpace:'nowrap' }}>Total Inv.</th>
                    <th className="r" style={{ fontSize:'10px', padding:'8px 4px', whiteSpace:'nowrap' }}>Real. P&L</th>
                    <th className="r" style={{ fontSize:'10px', padding:'8px 4px', whiteSpace:'nowrap' }}>Joined</th>
                    <th style={{ fontSize:'10px', padding:'8px 4px', textAlign:'center', whiteSpace:'nowrap' }}>Mirror</th>
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
                      <td className="num">{sub.totalTrades}</td>
                      <td className="num"><span style={{ color:'var(--bull)', fontWeight:600 }}>{sub.openTrades}</span></td>
                      <td className="num"><span style={{ color:'var(--muted)' }}>{sub.closedTrades}</span></td>
                      <td className="num">{sub.totalInvestment ? `Rs.${toINR(sub.totalInvestment)}` : '—'}</td>
                      <td className="num">
                        {sub.realisedPnL !== 0
                          ? <span className={sub.realisedPnL>=0?'pnl-pos':'pnl-neg'}>{pnlSign(sub.realisedPnL)}{toINRd(Math.abs(sub.realisedPnL))}</span>
                          : <span style={{ color:'var(--muted)' }}>—</span>}
                      </td>
                      <td className="num" style={{ color:'var(--muted)' }}>{sub.created_at?.slice(0,10)}</td>
                      <td style={{ textAlign:'center' }} onClick={e => e.stopPropagation()}>
                        {sub.isAdmin ? <span className="neutral" style={{ fontSize:'11px' }}>—</span> : (
                          <div style={{ display:'flex', gap:'6px', justifyContent:'center' }}>
                            <button onClick={() => toggleMirror(sub)} className="btn btn-ghost" style={{ fontSize:'10px', padding:'3px 8px', color: mirrored[sub.id] ? 'var(--bear)' : 'var(--bull)', borderColor: mirrored[sub.id] ? 'var(--bear)' : 'var(--bull)', fontWeight:700 }}>
                              {mirrored[sub.id] ? '× Unlink' : '+ Fetch'}
                            </button>
                            <button onClick={e => { e.stopPropagation(); handleDeleteSubscriber(sub) }}
                              style={{ fontSize:'11px', padding:'4px 10px', background:'none', border:'1px solid var(--bear)', color:'var(--bear)', borderRadius:'4px', cursor:'pointer', fontFamily:'DM Mono, monospace', fontWeight:700 }}
                              title="Delete subscriber account">
                              🗑
                            </button>
                          </div>
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
              <button onClick={downloadCSV} style={{ padding:'5px 12px', background:'var(--surface)', border:'1px solid var(--border)', color:'var(--muted)', borderRadius:'4px', cursor:'pointer', fontSize:'10px', fontFamily:'DM Mono, monospace' }}>⬇ CSV</button>

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
              <div style={{ borderRadius:"8px", border:"1px solid var(--border)", marginBottom:"8px", overflowX:"auto", width:"100%" }}>
                <table className="data-table" style={{ tableLayout:'fixed', width:'100%' }}>
                  <colgroup>
                    <col style={{ width:'12%' }} />
                    <col style={{ width:'7%' }} />
                    <col style={{ width:'8%' }} />
                    <col style={{ width:'8%' }} />
                    <col style={{ width:'9%' }} />
                    <col style={{ width:'7%' }} />
                    <col style={{ width:'7%' }} />
                    <col style={{ width:'10%' }} />
                    <col style={{ width:'8%' }} />
                    <col style={{ width:'9%' }} />
                    <col style={{ width:'9%' }} />
                    <col style={{ width:'6%' }} />
                  </colgroup>
                  <thead>
                    <tr>
                      {[
                        { key:'ticker', label:'Ticker', filterable:true },
                        { key:'account', label:'Account', filterable:true },
                        { key:'entry_date', label:'Entry Date' },
                        { key:'entry_price', label:'Entry Rs.', right:true },
                        { key:'cmp', label:'CMP', right:true },
                        { key:'exit_price', label:'Exit Rs.', right:true },
                        { key:'quantity', label:'Qty / Curr', right:true },
                        { key:'invested_capital', label:'Inv / Actual', right:true },
                        { key:'mtf_int', label:'MTF Int', right:true },
                        { key:'unrealised', label:'Unreal. P&L', right:true },
                        { key:'realised', label:'Real. P&L', right:true },
                        { key:'status', label:'Status', filterable:true },
                      ].map(col => (
                        <th key={col.key} className={col.right ? 'r' : undefined} style={{ cursor:'pointer', fontSize:'10px' }}
                          onClick={() => subTf.handleSort(col.key)}>
                          <div className="col-header" style={col.right ? { justifyContent:'flex-end' } : undefined}>
                            <span>{col.label}</span>
                            <span className={`sort-arrow${subTf.sortConfig?.key===col.key?' active':''}`}>
                              {subTf.sortConfig?.key===col.key?(subTf.sortConfig.direction==='asc'?'↑':'↓'):'↕'}
                            </span>
                            {col.filterable && (
                              <span className={`filter-icon${(subTf.columnFilters[col.key]?.size||0)>0?' has-filter':''}`}
                                onClick={e => subTf.openFilter(e, col.key)}>▼</span>
                            )}
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {subTf.filteredData.map(trade => {
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
                          <td style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', fontSize:'11px' }}>
                            <div className="tk-cell">
                              <span className="tk-name">{trade.ticker}</span>
                              <div className="tk-badges">
                                <span className={trade.direction==='LONG'?'dir-long':'dir-short'}>{trade.direction}</span>
                              </div>
                            </div>
                          </td>
                          <td style={{ fontSize:'11px', color:'var(--muted)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{trade.account || '—'}</td>
                          <td style={{ fontSize:'11px', color:'var(--muted)' }}>{trade.entry_date?.slice(0,10)}</td>
                          <td className="num" style={{ fontSize:'11px' }}>Rs.{toINRd(entryPrice)}</td>
                          <td className="num" style={{ fontSize:'11px' }}>
                            {cmp ? <div className="sc"><span className="sc1">Rs.{toINRd(cmp)}</span><span className="sc2" style={{ color:lp.change>=0?'var(--bull)':'var(--bear)' }}>{lp.change>=0?'+':''}{lp.changePercent?.toFixed(2)}%</span></div> : <span style={{ color:'var(--muted)' }}>—</span>}
                          </td>
                          <td className="num" style={{ fontSize:'11px' }}>{exitPrice ? `Rs.${toINRd(exitPrice)}` : <span style={{ color:'var(--muted)' }}>—</span>}</td>
                          <td className="num" style={{ fontSize:'11px' }}>
                            <div className="sc">
                              <span className="sc1">{toINR(originalQty)}</span>
                              <span className="sc2" style={{ color:currentQty===0?'var(--bear)':currentQty<originalQty?'var(--gold)':'var(--muted)' }}>{toINR(currentQty)}</span>
                            </div>
                          </td>
                          <td className="num" style={{ fontSize:'11px' }}>
                            {investment ? <div className="sc"><span className="sc1">Rs.{toINRd(investment)}</span><span className="sc2">{actualInv ? `Rs.${toINRd(actualInv)}` : '—'}</span></div> : <span style={{ color:'var(--muted)' }}>—</span>}
                          </td>
                          <td className="num" style={{ fontSize:'11px' }}>{mtfInt ? <span className="mtf-val">Rs.{toINRd(mtfInt)}</span> : <span style={{ color:'var(--muted)' }}>—</span>}</td>
                          <td className="num" style={{ fontSize:'11px' }}>{unrealisedPnL !== null ? <span className={unrealisedPnL>=0?'pnl-pos':'pnl-neg'}>{pnlSign(unrealisedPnL)}{toINRd(Math.abs(unrealisedPnL))}</span> : <span style={{ color:'var(--muted)' }}>—</span>}</td>
                          <td className="num" style={{ fontSize:'11px' }}>{realisedPnL !== 0 || trade.status==='CLOSED' ? <span className={realisedPnL>=0?'pnl-pos':'pnl-neg'}>{pnlSign(realisedPnL)}{toINRd(Math.abs(realisedPnL))}</span> : <span style={{ color:'var(--muted)' }}>—</span>}</td>
                          <td style={{ fontSize:'11px' }}>{trade.status==='OPEN' ? <span className="st-open">OPEN</span> : <span className="st-closed">CLOSED</span>}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
                {subTf.openFilterKey && (
                  <FilterDropdown
                    position={subTf.filterDropPos}
                    uniqueValues={subTf.getUniqueValues(subTf.openFilterKey)}
                    hiddenValues={subTf.columnFilters[subTf.openFilterKey] || new Set()}
                    onToggle={v => subTf.toggleFilterValue(subTf.openFilterKey, v)}
                    onSelectAll={() => subTf.selectAllFilter(subTf.openFilterKey)}
                    onDeselectAll={() => subTf.deselectAllFilter(subTf.openFilterKey, subTf.getUniqueValues(subTf.openFilterKey))}
                    onClose={() => subTf.setOpenFilterKey(null)}
                  />
                )}
              </div>
            )}
          </div>
        )}
      </main>
    </>
  )
}
