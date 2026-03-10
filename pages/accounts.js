import React, { useState, useEffect, useCallback } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'
import { supabase } from '../lib/supabase'
import { differenceInDays } from 'date-fns'
import AddTradeModal from '../components/AddTradeModal'
import EditTradeModal from '../components/EditTradeModal'
import ExecutionPanel from '../components/ExecutionPanel'

function NavPill({ active, isAdmin }) {
  const router = useRouter()
  const items = [
    { label:'Dashboard', path:'/dashboard' },
    { label:'Accounts', path:'/accounts' },
    ...(isAdmin ? [{ label:'Subscribers', path:'/subscribers' }] : []),
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
  const [editingTrade, setEditingTrade] = useState(null)
  const [openMenu, setOpenMenu] = useState(null)
  const [expandedTrade, setExpandedTrade] = useState(null)
  const [executions, setExecutions] = useState({})
  const [showNewAccount, setShowNewAccount] = useState(false)
  const [newAccountName, setNewAccountName] = useState('')
  const [countdown, setCountdown] = useState(60)
  const [mirroredAccounts, setMirroredAccounts] = useState([])
  const [mirroredTrades, setMirroredTrades] = useState({})
  const [mirroredExecs, setMirroredExecs] = useState({})
  const [activeMirror, setActiveMirror] = useState(null)
  const [mirrorFilter, setMirrorFilter] = useState('ALL')

  useEffect(() => {
    supabase.auth.getSession().then(({ data:{ session } }) => { setSession(session); if (!session) router.push('/') })
    const { data:{ subscription } } = supabase.auth.onAuthStateChange((_,s) => { setSession(s); if (!s) router.push('/') })
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    const close = () => setOpenMenu(null)
    document.addEventListener('click', close)
    return () => document.removeEventListener('click', close)
  }, [])

  useEffect(() => {
    const t = setInterval(() => setCountdown(c => c<=1?60:c-1), 1000)
    return () => clearInterval(t)
  }, [])

  const isAdmin = session?.user?.email === 'gogoaheadgo@gmail.com'

  const getToken = async () => (await supabase.auth.getSession()).data.session?.access_token

  const loadMirroredTrades = useCallback(async (subscriber_id, token) => {
    const t = token || await getToken()
    const res = await fetch(`/api/admin/subscriber-trades?user_id=${subscriber_id}`, { headers:{ Authorization:`Bearer ${t}` } })
    const data = await res.json()
    if (data.trades) {
      setMirroredTrades(prev => ({ ...prev, [subscriber_id]: data.trades }))
      setMirroredExecs(prev => ({ ...prev, [subscriber_id]: data.executions || [] }))
      const tickers = [...new Set(data.trades.filter(t=>t.status==='OPEN').map(t=>t.ticker))]
      tickers.forEach(async ticker => {
        try {
          const r = await fetch(`/api/stock/${ticker}`)
          const d = await r.json()
          if (d.price) setLivePrices(prev => ({ ...prev, [ticker]: d }))
        } catch {}
      })
    }
  }, [])

  const loadMirroredAccounts = useCallback(async () => {
    const token = await getToken()
    if (!token) return
    const res = await fetch('/api/admin/mirror', { headers:{ Authorization:`Bearer ${token}` } })
    const data = await res.json()
    if (!Array.isArray(data)) return
    setMirroredAccounts(data)
    data.forEach(m => loadMirroredTrades(m.subscriber_id, token))
  }, [loadMirroredTrades])

  const loadData = useCallback(async () => {
    if (!session) return
    setLoading(true)
    const token = await getToken()
    const [tRes, aRes] = await Promise.all([
      fetch('/api/trades', { headers:{ Authorization:`Bearer ${token}` } }),
      fetch('/api/accounts', { headers:{ Authorization:`Bearer ${token}` } }),
    ])
    const tData = await tRes.json()
    const aData = await aRes.json()
    if (Array.isArray(tData)) {
      setTrades(tData)
      // Await executions so stat cards are never stale
      await fetchAllExecutions(tData)
      // executions fully replaced by fetchAllExecutions above
    }
    if (Array.isArray(aData)) {
      setAccounts(aData)
      if (aData.length > 0) setActiveAccount(prev => prev || aData[0].name)
    }
    setLoading(false)
  }, [session]) // eslint-disable-line

  useEffect(() => { if (session) loadData() }, [session, loadData])

  useEffect(() => {
    if (!session || !isAdmin) return
    loadMirroredAccounts()
    const onFocus = () => loadMirroredAccounts()
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [session, isAdmin, loadMirroredAccounts])

  useEffect(() => {
    if (!isAdmin || mirroredAccounts.length === 0) return
    const channel = supabase.channel('mirrored-trades-changes')
      .on('postgres_changes', { event:'*', schema:'public', table:'trades' }, () => {
        mirroredAccounts.forEach(m => loadMirroredTrades(m.subscriber_id))
      })
      .on('postgres_changes', { event:'*', schema:'public', table:'executions' }, () => {
        mirroredAccounts.forEach(m => loadMirroredTrades(m.subscriber_id))
      })
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [isAdmin, mirroredAccounts, loadMirroredTrades])

  const fetchPrice = useCallback(async (ticker) => {
    try {
      const res = await fetch(`/api/stock/${ticker}`)
      const data = await res.json()
      if (data.price) setLivePrices(prev => ({ ...prev, [ticker]:data }))
    } catch {}
  }, [])

  useEffect(() => {
    if (!session || !trades.length) return
    // Fetch prices for ALL open trades across all accounts for correct stat cards
    const symbols = [...new Set(trades.filter(t => t.status==='OPEN').map(t => t.ticker))]
    symbols.forEach(fetchPrice)
  }, [trades, session]) // eslint-disable-line

  useEffect(() => {
    if (countdown===60 && session && trades.length) {
      const symbols = [...new Set(trades.filter(t => t.status==='OPEN').map(t => t.ticker))]
      symbols.forEach(fetchPrice)
    }
  }, [countdown]) // eslint-disable-line

  const fetchExecutions = async (tradeId) => {
    const token = await getToken()
    const res = await fetch(`/api/executions?trade_id=${tradeId}`, { headers:{ Authorization:`Bearer ${token}` } })
    const data = await res.json()
    if (Array.isArray(data)) setExecutions(prev => ({ ...prev, [tradeId]:data }))
  }

  const fetchAllExecutions = async (tradeList) => {
    const token = await getToken()
    const results = await Promise.all(
      tradeList.map(t => fetch(`/api/executions?trade_id=${t.id}`, { headers:{ Authorization:`Bearer ${token}` } }).then(r=>r.json()))
    )
    const map = {}
    tradeList.forEach((t,i) => { if (Array.isArray(results[i])) map[t.id] = results[i] })
    setExecutions(map) // full replace — removes orphaned execs from deleted trades
  }

  const addExecution = async (tradeId, execution) => {
    const token = await getToken()
    const res = await fetch('/api/executions', { method:'POST', headers:{ 'Content-Type':'application/json', Authorization:`Bearer ${token}` }, body:JSON.stringify({ trade_id:tradeId, ...execution }) })
    const text = await res.text()
    let data
    try { data = JSON.parse(text) } catch { throw new Error('Server error') }
    if (data.error) throw new Error(data.error)
    await fetchExecutions(tradeId)
  }

  const deleteExecution = async (execId, tradeId) => {
    const token = await getToken()
    await fetch('/api/executions', { method:'DELETE', headers:{ 'Content-Type':'application/json', Authorization:`Bearer ${token}` }, body:JSON.stringify({ id:execId }) })
    await fetchExecutions(tradeId)
  }

  const handleRowClick = (tradeId) => {
    setExpandedTrade(prev => prev===tradeId ? null : tradeId)
    if (!executions[tradeId]) fetchExecutions(tradeId)
  }

  const handleAddTrade = async (tradeData) => {
    const token = await getToken()
    const res = await fetch('/api/trades', { method:'POST', headers:{ 'Content-Type':'application/json', Authorization:`Bearer ${token}` }, body:JSON.stringify({ ...tradeData, account:activeAccount }) })
    const data = await res.json()
    if (data.error) throw new Error(data.error)
    await loadData()
  }

  const handleEdit = async (updates) => {
    const token = await getToken()
    await fetch('/api/trades', { method:'PUT', headers:{ 'Content-Type':'application/json', Authorization:`Bearer ${token}` }, body:JSON.stringify({ id:editingTrade.id, ...updates }) })
    setEditingTrade(null)
    // Clear cached executions for this trade so recalculation uses fresh data
    setExecutions(prev => { const n = {...prev}; delete n[editingTrade.id]; return n })
    await loadData()
  }

  const handleAutoClose = async (tradeId, updates) => {
    const token = await getToken()
    await fetch('/api/trades', { method:'PUT', headers:{ 'Content-Type':'application/json', Authorization:`Bearer ${token}` }, body:JSON.stringify({ id:tradeId, ...updates }) })
    await loadData()
  }

  const handleDelete = async (id) => {
    if (!confirm('Delete this trade?')) return
    const token = await getToken()
    await fetch('/api/trades', { method:'DELETE', headers:{ 'Content-Type':'application/json', Authorization:`Bearer ${token}` }, body:JSON.stringify({ id }) })
    // Remove executions for deleted trade immediately
    setExecutions(prev => { const n = {...prev}; delete n[id]; return n })
    await loadData()
  }

  const handleCreateAccount = async () => {
    if (!newAccountName.trim()) return
    const token = await getToken()
    await fetch('/api/accounts', { method:'POST', headers:{ 'Content-Type':'application/json', Authorization:`Bearer ${token}` }, body:JSON.stringify({ name:newAccountName.trim().toUpperCase() }) })
    setNewAccountName(''); setShowNewAccount(false); await loadData()
  }

  const handleRenameAccount = async (acc) => {
    const n = prompt('Rename account:', acc.name)
    if (!n || !n.trim()) return
    const token = await getToken()
    await fetch('/api/accounts', { method:'PUT', headers:{ 'Content-Type':'application/json', Authorization:`Bearer ${token}` }, body:JSON.stringify({ id:acc.id, name:n.trim().toUpperCase() }) })
    await loadData()
  }

  const handleDeleteAccount = async (acc) => {
    if (!confirm(`Delete account "${acc.name}"? All trades will be deleted.`)) return
    const token = await getToken()
    await fetch('/api/accounts', { method:'DELETE', headers:{ 'Content-Type':'application/json', Authorization:`Bearer ${token}` }, body:JSON.stringify({ id:acc.id, name:acc.name }) })
    setActiveAccount(accounts.find(a => a.name !== acc.name)?.name || null)
    await loadData()
  }

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

  const toINR = (n) => Number(n||0).toLocaleString('en-IN', { maximumFractionDigits:0 })
  const toINRd = (n) => Number(n||0).toLocaleString('en-IN', { minimumFractionDigits:2, maximumFractionDigits:2 })
  const toPrice = (n) => Number(n||0).toLocaleString('en-IN', { minimumFractionDigits:2, maximumFractionDigits:2 })

  // Per-account filtered trades
  const accountTrades = trades.filter(t => t.account === activeAccount)
  const filtered = accountTrades.filter(t => filter==='ALL' || t.status===filter)
  const openTrades = accountTrades.filter(t => t.status==='OPEN')
  const closedTrades = accountTrades.filter(t => t.status==='CLOSED')

  // ── AGGREGATE STATS: ALL own accounts + ALL mirrored ──
  const allOwnExecs = Object.values(executions).flat()
  const ownTradeIds = new Set(trades.map(t => t.id))
  const ownUserId = session?.user?.id
  // Exclude mirrored subscribers who are the same user as admin (prevents double-count)
  const otherMirroredTrades = Object.entries(mirroredTrades)
    .filter(([subId]) => subId !== ownUserId)
    .flatMap(([, ts]) => ts)
  const allMirroredTrades = otherMirroredTrades.filter(t => !ownTradeIds.has(t.id))
  const mirroredTradeIds = new Set(allMirroredTrades.map(t => t.id))
  const allMirroredExecs = Object.entries(mirroredExecs)
    .filter(([subId]) => subId !== ownUserId)
    .flatMap(([, es]) => es)
    .filter(e => mirroredTradeIds.has(e.trade_id))
  const hasMirrored = allMirroredTrades.length > 0
  // Fetch live prices for ALL open trades across all accounts (not just active account)
  // so unrealised stat card is correct

  const calcMTF = (tradeList) => tradeList.reduce((s,t) => {
    if (!t.mtf_interest_rate || !t.entry_date) return s
    const totalVal = Number(t.invested_capital) || (Number(t.entry_price) * Number(t.quantity))
    if (!totalVal) return s
    const margin = Number(t.actual_investment) || 0
    const base = margin > 0 ? totalVal - margin : totalVal
    if (base <= 0) return s
    const end = t.status==='CLOSED' && t.exit_date ? new Date(t.exit_date) : new Date()
    return s + (base * t.mtf_interest_rate * Math.max(1, differenceInDays(end, new Date(t.entry_date)))) / 36500
  }, 0)

  const calcRealised = (tradeList, execList) => tradeList.reduce((sum, t) => {
    const execs = execList.filter(e => e.trade_id === t.id)
    if (execs.length > 0)
      return sum + execs.reduce((s,e) => s + (Number(e.price) - Number(t.entry_price)) * Number(e.quantity), 0)
    return sum + (Number(t.realized_gains) || 0)
  }, 0)

  const totalRealised = calcRealised(trades, allOwnExecs) + calcRealised(allMirroredTrades, allMirroredExecs)
  const totalMTF = calcMTF(trades) + calcMTF(allMirroredTrades)
  const totalOpen = trades.filter(t=>t.status==='OPEN').length + allMirroredTrades.filter(t=>t.status==='OPEN').length
  const totalClosed = trades.filter(t=>t.status==='CLOSED').length + allMirroredTrades.filter(t=>t.status==='CLOSED').length

  const calcUnrealised = (tradeList, execList) => tradeList
    .filter(t => t.status === 'OPEN')
    .reduce((sum, t) => {
      const cmp = livePrices[t.ticker]?.price
      if (!cmp) return sum
      const soldQty = execList.filter(e => e.trade_id === t.id).reduce((s,e) => s + Number(e.quantity), 0)
      const currentQty = Math.max(0, Number(t.quantity) - soldQty)
      const entry = Number(t.entry_price) || 0
      const pnl = t.direction === 'SHORT' ? (entry - cmp) * currentQty : (cmp - entry) * currentQty
      return sum + pnl
    }, 0)

  const totalUnrealised = calcUnrealised(trades, allOwnExecs) + calcUnrealised(allMirroredTrades, allMirroredExecs)

  if (!session) return null

  return (
    <>
      <div className="tricolor-bar" />
      <Head><title>Accounts — CHiiRAG Stock Journal</title></Head>
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
        <NavPill active="Accounts" isAdmin={isAdmin} />
        <div style={{ display:'flex', gap:'8px', alignItems:'center' }}>
          {openTrades.length > 0 && <span style={{ fontSize:'10px', color:'var(--muted)' }}>↻ {countdown}s</span>}
          <button onClick={() => setShowAdd(true)} className="btn btn-primary" style={{ padding:'6px 14px', fontSize:'11px' }}>+ New Trade</button>
          <ExitMenu />
        </div>
      </header>

      <main style={{ maxWidth:'1400px', margin:'0 auto', padding:'20px 16px' }}>

        {/* ── AGGREGATE STATS (always visible) ── */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(150px,1fr))', gap:'10px', marginBottom:'20px' }}>
          {[
            { label:'Unrealised P&L', value:`${totalUnrealised>=0?'+':'−'}Rs${toINRd(Math.abs(totalUnrealised))}`, color:totalUnrealised>=0?'var(--bull)':'var(--bear)' },
            { label:'Realised P&L', value:`${totalRealised>=0?'+':'−'}Rs${toINRd(Math.abs(totalRealised))}`, color:totalRealised>=0?'var(--bull)':'var(--bear)' },
            { label:'Open Positions', value:totalOpen, color:'var(--accent)' },
            { label:'Closed Trades', value:totalClosed },
            { label:'MTF Interest', value:`Rs${toINRd(totalMTF)}`, color:'var(--gold)' },
          ].map(s => (
            <div key={s.label} className="stat-card">
              <div style={{ fontSize:'9px', color:'var(--muted)', letterSpacing:'0.12em', textTransform:'uppercase', marginBottom:'6px' }}>
                {s.label}{hasMirrored ? <span style={{ marginLeft:'4px', fontSize:'8px', color:'var(--gold)', opacity:0.7 }}>+mirrored</span> : null}
              </div>
              <div style={{ fontSize:'20px', fontWeight:700, fontFamily:'Bookman Old Style, serif', color:s.color||'var(--text)' }}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* Account Tiles */}
        <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'20px', flexWrap:'wrap' }}>
          {accounts.map(acc => (
            <div key={acc.id} style={{ border:`2px solid ${activeAccount===acc.name&&!activeMirror?'var(--accent)':'var(--border)'}`, background:activeAccount===acc.name&&!activeMirror?'var(--accent-dim)':'var(--surface)', borderRadius:'10px', minWidth:'120px' }}>
              <button onClick={() => { setActiveAccount(acc.name); setActiveMirror(null) }} style={{ width:'100%', padding:'14px 16px 10px', background:'transparent', border:'none', cursor:'pointer', textAlign:'left' }}>
                <div style={{ fontSize:'14px', fontWeight:700, fontFamily:'DM Mono, monospace', color:activeAccount===acc.name&&!activeMirror?'var(--accent)':'var(--text)' }}>{acc.name}</div>
                <div style={{ fontSize:'10px', color:'var(--muted)', marginTop:'3px' }}>{trades.filter(t=>t.account===acc.name).length} trades</div>
              </button>
              <div style={{ display:'flex', borderTop:'1px solid var(--border)' }}>
                <button onClick={() => handleRenameAccount(acc)} style={{ flex:1, padding:'6px', background:'none', border:'none', borderRight:'1px solid var(--border)', color:'var(--muted)', cursor:'pointer', fontSize:'11px' }}>✎</button>
                <button onClick={() => handleDeleteAccount(acc)} style={{ flex:1, padding:'6px', background:'none', border:'none', color:'var(--muted)', cursor:'pointer', fontSize:'13px' }}>🗑</button>
              </div>
            </div>
          ))}
          {showNewAccount ? (
            <div style={{ display:'flex', gap:'6px', alignItems:'center' }}>
              <input value={newAccountName} onChange={e=>setNewAccountName(e.target.value)} onKeyDown={e=>e.key==='Enter'&&handleCreateAccount()} placeholder="ACCOUNT NAME" autoFocus style={{ background:'var(--surface)', border:'1px solid var(--accent)', borderRadius:'6px', padding:'6px 12px', color:'var(--text)', fontSize:'11px', fontFamily:'DM Mono, monospace', width:'140px', outline:'none' }} />
              <button onClick={handleCreateAccount} className="btn btn-primary" style={{ padding:'6px 12px', fontSize:'11px' }}>Add</button>
              <button onClick={() => { setShowNewAccount(false); setNewAccountName('') }} className="btn btn-ghost" style={{ padding:'6px 10px', fontSize:'11px' }}>✕</button>
            </div>
          ) : (
            <button onClick={() => setShowNewAccount(true)} style={{ padding:'7px 14px', borderRadius:'6px', border:'1px dashed var(--border)', background:'transparent', color:'var(--muted)', cursor:'pointer', fontSize:'11px', fontFamily:'DM Mono, monospace' }}>+ New Account</button>
          )}
          {/* Mirrored Account Tiles */}
          {mirroredAccounts.map(m => (
            <div key={m.subscriber_id}
              onClick={() => { setActiveMirror(prev => prev===m.subscriber_id ? null : m.subscriber_id); setMirrorFilter('ALL') }}
              style={{ border:`2px solid ${activeMirror===m.subscriber_id?'var(--gold)':'var(--border)'}`, background:activeMirror===m.subscriber_id?'rgba(245,158,11,0.08)':'var(--surface)', borderRadius:'10px', minWidth:'120px', cursor:'pointer', padding:'14px 16px 10px' }}>
              <div style={{ fontSize:'14px', fontWeight:700, fontFamily:'DM Mono, monospace', color:activeMirror===m.subscriber_id?'var(--gold)':'var(--muted)' }}>
                {(m.subscriber_name||m.subscriber_email||'').split(' ')[0]}'s
              </div>
              <div style={{ fontSize:'10px', color:'var(--gold)', marginTop:'3px', opacity:0.7 }}>
                {(mirroredTrades[m.subscriber_id]||[]).length} trades · LIVE
              </div>
            </div>
          ))}
        </div>

        {/* ── MAIN CONTENT AREA ── */}
        {loading ? (
          <div style={{ textAlign:'center', padding:'60px', color:'var(--muted)' }}>Loading...</div>
        ) : activeMirror ? (
          // Mirrored portfolio view
          (() => {
            const mirrorInfo = mirroredAccounts.find(m => m.subscriber_id === activeMirror)
            const mTrades = mirroredTrades[activeMirror] || []
            const mExecs = mirroredExecs[activeMirror] || []
            return (
              <div>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'14px', flexWrap:'wrap', gap:'8px' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
                    <span style={{ fontSize:'13px', fontWeight:700, color:'var(--gold)', fontFamily:'DM Mono, monospace' }}>
                      {mirrorInfo?.subscriber_name}'s Portfolio
                    </span>
                    <span style={{ fontSize:'10px', background:'rgba(245,158,11,0.1)', color:'var(--gold)', padding:'2px 8px', borderRadius:'4px', fontFamily:'DM Mono, monospace' }}>READ ONLY · LIVE SYNC</span>
                    <button onClick={() => loadMirroredTrades(activeMirror)} style={{ background:'none', border:'1px solid var(--border)', borderRadius:'4px', color:'var(--muted)', cursor:'pointer', fontSize:'11px', padding:'2px 8px' }}>↻ Refresh</button>
                  </div>
                  <div style={{ display:'flex', gap:'6px' }}>
                    {['ALL','OPEN','CLOSED'].map(f => (
                      <button key={f} onClick={() => setMirrorFilter(f)}
                        style={{ padding:'4px 12px', borderRadius:'4px', border:`1px solid ${mirrorFilter===f?'var(--gold)':'var(--border)'}`, background:mirrorFilter===f?'rgba(245,158,11,0.1)':'transparent', color:mirrorFilter===f?'var(--gold)':'var(--muted)', cursor:'pointer', fontSize:'10px', fontFamily:'DM Mono, monospace', fontWeight:600 }}>
                        {f} ({f==='ALL'?mTrades.length:mTrades.filter(t=>t.status===f).length})
                      </button>
                    ))}
                  </div>
                </div>
                {mTrades.length === 0 ? (
                  <div style={{ color:'var(--muted)', fontSize:'13px', padding:'20px' }}>No trades found.</div>
                ) : (
                  <div style={{ overflowX:'auto', border:'1px solid var(--border)', borderRadius:'8px' }}>
                    <table className="trade-table" style={{ width:'100%' }}>
                      <thead>
                        <tr>
                          <th>Ticker</th><th>Direction</th><th>Account</th><th>Entry Date</th>
                          <th className="right">Entry Rs</th><th className="right">CMP</th>
                          <th className="right">Exit Rs</th><th className="right">Qty</th>
                          <th className="right">Curr Qty</th><th className="right">Investment</th>
                          <th className="right">Actual Inv</th>
                          <th className="right">MTF Interest</th>
                          <th className="right">Unrealised P&L</th><th className="right">Realised P&L</th>
                          <th className="right">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(mirrorFilter==='ALL' ? mTrades : mTrades.filter(t=>t.status===mirrorFilter)).map(trade => {
                          const execs = mExecs.filter(e => e.trade_id === trade.id)
                          const totalSoldQty = execs.reduce((s,e) => s + Number(e.quantity), 0)
                          const originalQty = Number(trade.quantity) || 0
                          const currentQty = Math.max(0, originalQty - totalSoldQty)
                          const entryPrice = Number(trade.entry_price) || 0
                          const investment = Number(trade.invested_capital) || (Number(trade.entry_price)*Number(trade.quantity))
                          const actualInv = Number(trade.actual_investment) || 0
                          const mtfBase = investment - actualInv
                          const lp = livePrices[trade.ticker]
                          const cmp = lp?.price
                          const realisedPnL = execs.length > 0
                        ? execs.reduce((s,e) => s + (Number(e.price) - entryPrice) * Number(e.quantity), 0)
                        : (Number(trade.realized_gains) || 0)
                          const unrealisedPnL = cmp && currentQty > 0 ? (trade.direction==='LONG' ? (cmp-entryPrice)*currentQty : (entryPrice-cmp)*currentQty) : null
                          const mtfInt = mtfBase > 0 && trade.mtf_interest_rate && trade.entry_date
                            ? execs.reduce((s,e) => { const days = Math.max(1, Math.floor((new Date(e.date)-new Date(trade.entry_date))/86400000)); return s + mtfBase*(Number(e.quantity)/originalQty)*trade.mtf_interest_rate*days/36500 }, 0)
                              + (currentQty > 0 ? mtfBase*(currentQty/originalQty)*trade.mtf_interest_rate*Math.max(1,Math.floor((new Date()-new Date(trade.entry_date))/86400000))/36500 : 0)
                            : null
                          const exitPrice = currentQty===0 && execs.length>0 ? execs.reduce((s,e)=>s+Number(e.price)*Number(e.quantity),0)/totalSoldQty : trade.exit_price||null
                          return (
                            <tr key={trade.id}>
                              <td><span className="ticker-badge">{trade.ticker}</span></td>
                              <td><span className={`badge badge-${trade.direction.toLowerCase()}`}>{trade.direction}</span></td>
                              <td className="muted" style={{ fontSize:'11px' }}>{trade.account||'—'}</td>
                              <td className="muted">{trade.entry_date?.slice(0,10)}</td>
                              <td className="right">Rs{toINRd(entryPrice)}</td>
                              <td className="right">{cmp ? <div><div style={{ fontWeight:600 }}>Rs{toINRd(cmp)}</div><div style={{ fontSize:'10px', color:lp.change>=0?'var(--bull)':'var(--bear)' }}>{lp.change>=0?'+':''}{lp.changePercent?.toFixed(2)}%</div></div> : <span className="neutral">—</span>}</td>
                              <td className="right">{exitPrice ? `Rs${toINRd(exitPrice)}` : <span className="neutral">—</span>}</td>
                              <td className="right">{toINR(originalQty)}</td>
                              <td className="right"><span style={{ fontWeight:700, color:currentQty===0?'var(--bear)':currentQty<originalQty?'var(--gold)':'var(--text)' }}>{toINR(currentQty)}</span></td>
                              <td className="right">{investment ? `Rs${toINRd(investment)}` : <span className="neutral">—</span>}</td>
                              <td className="right">{actualInv ? `Rs${toINRd(actualInv)}` : <span className="neutral">—</span>}</td>
                              <td className="right">{mtfInt ? <span style={{ color:'var(--gold)' }}>Rs{toINRd(mtfInt)}</span> : <span className="neutral">—</span>}</td>
                              <td className="right">{unrealisedPnL !== null ? <span style={{ color:unrealisedPnL>=0?'var(--bull)':'var(--bear)', fontWeight:600 }}>{unrealisedPnL>=0?'+':'−'}Rs{toINRd(Math.abs(unrealisedPnL))}</span> : <span className="neutral">—</span>}</td>
                              <td className="right">{realisedPnL !== 0 || trade.status==='CLOSED' ? <span style={{ color:realisedPnL>=0?'var(--bull)':'var(--bear)', fontWeight:600 }}>{realisedPnL>=0?'+':'−'}Rs{toINRd(Math.abs(realisedPnL))}</span> : <span className="neutral">—</span>}</td>
                              <td className="right"><span style={{ fontSize:'10px', fontWeight:700, color:trade.status==='OPEN'?'var(--bull)':'var(--muted)', background:trade.status==='OPEN'?'rgba(0,230,118,0.1)':'var(--surface)', padding:'2px 8px', borderRadius:'4px' }}>{trade.status}</span></td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )
          })()
        ) : !activeAccount ? (
          <div style={{ textAlign:'center', padding:'80px', color:'var(--muted)' }}>No accounts yet.</div>
        ) : (
          <>
            {/* Filter */}
            <div style={{ display:'flex', gap:'6px', marginBottom:'14px' }}>
              {['ALL','OPEN','CLOSED'].map(f => (
                <button key={f} onClick={() => setFilter(f)} style={{ padding:'5px 14px', borderRadius:'4px', border:`1px solid ${filter===f?'var(--accent)':'var(--border)'}`, background:filter===f?'var(--accent-dim)':'transparent', color:filter===f?'var(--accent)':'var(--muted)', cursor:'pointer', fontSize:'10px', fontFamily:'DM Mono, monospace', fontWeight:600 }}>
                  {f} ({f==='ALL'?accountTrades.length:f==='OPEN'?openTrades.length:closedTrades.length})
                </button>
              ))}
            </div>

            {filtered.length === 0 ? (
              <div style={{ textAlign:'center', padding:'60px', color:'var(--muted)', border:'1px dashed var(--border)', borderRadius:'8px' }}>No trades. Click "+ New Trade" to add one.</div>
            ) : (
              <div style={{ overflowX:'auto' }}>
                <table className="trade-table">
                  <thead>
                    <tr>
                      <th>Ticker</th><th>Direction</th><th>Entry Date</th>
                      <th className="right">Entry Rs</th><th className="right">CMP</th>
                      <th className="right">Exit Rs</th><th className="right">Qty</th>
                      <th className="right">Current Qty</th>
                      <th className="right">Investment</th><th className="right">Actual Inv</th>
                      <th className="right">MTF Interest</th>
                      <th className="right">Unrealised P&L</th><th className="right">Realised P&L</th>
                      <th style={{ textAlign:'center' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(trade => {
                      const execs = executions[trade.id] || []
                      const totalSoldQty = execs.reduce((s,e) => s + Number(e.quantity), 0)
                      const originalQty = Number(trade.quantity) || 0
                      const currentQty = Math.max(0, originalQty - totalSoldQty)
                      const isClosed = currentQty === 0
                      const isOpen = !isClosed
                      const lp = livePrices[trade.ticker]
                      const entryPrice = Number(trade.entry_price) || 0
                      const investment = Number(trade.invested_capital) || (Number(trade.entry_price)*Number(trade.quantity))
                      const actualInv = Number(trade.actual_investment) || 0
                      const mtfBase = investment - actualInv
                      const realisedPnL = execs.length > 0
                        ? execs.reduce((s,e) => s + (Number(e.price) - entryPrice) * Number(e.quantity), 0)
                        : (Number(trade.realized_gains) || 0)
                      const cmp = lp?.price
                      const unrealisedPnL = cmp && currentQty > 0
                        ? (trade.direction==='LONG' ? (cmp - entryPrice)*currentQty : (entryPrice - cmp)*currentQty)
                        : null
                      const mtfInt = mtfBase > 0 && trade.mtf_interest_rate && trade.entry_date
                        ? execs.reduce((s,e) => {
                            const days = Math.max(1, Math.floor((new Date(e.date) - new Date(trade.entry_date)) / 86400000))
                            return s + mtfBase * (Number(e.quantity)/originalQty) * trade.mtf_interest_rate * days / 36500
                          }, 0) + (currentQty > 0
                            ? mtfBase * (currentQty/originalQty) * trade.mtf_interest_rate * Math.max(1, Math.floor((new Date() - new Date(trade.entry_date)) / 86400000)) / 36500
                            : 0)
                        : null
                      const exitPrice = isClosed && execs.length > 0
                        ? execs.reduce((s,e) => s + Number(e.price)*Number(e.quantity), 0) / totalSoldQty
                        : trade.exit_price || null
                      return (
                        <>
                          <tr key={trade.id} className={isOpen?'row-open':'row-closed'} onClick={() => handleRowClick(trade.id)} style={{ cursor:'pointer' }}>
                            <td><span className="ticker-badge">{trade.ticker}</span></td>
                            <td><span className={`badge badge-${trade.direction.toLowerCase()}`}>{trade.direction}</span></td>
                            <td className="muted">{trade.entry_date?.slice(0,10)}</td>
                            <td className="right">Rs{toINRd(entryPrice)}</td>
                            <td className="right">
                              {isOpen && lp ? <div><div style={{ fontWeight:600 }}>Rs{toINRd(lp.price)}</div><div style={{ fontSize:'10px', color:lp.change>=0?'var(--bull)':'var(--bear)' }}>{lp.change>=0?'+':''}{lp.changePercent?.toFixed(2)}%</div></div> : <span className="neutral">—</span>}
                            </td>
                            <td className="right">{exitPrice ? `Rs${toINRd(exitPrice)}` : <span className="neutral">—</span>}</td>
                            <td className="right">{toINR(originalQty)}</td>
                            <td className="right"><span style={{ fontWeight:700, color:currentQty===0?'var(--bear)':currentQty<originalQty?'var(--gold)':'var(--text)' }}>{toINR(currentQty)}</span></td>
                            <td className="right">{investment ? `Rs${toINRd(investment)}` : <span className="neutral">—</span>}</td>
                            <td className="right">{actualInv ? `Rs${toINRd(actualInv)}` : <span className="neutral">—</span>}</td>
                            <td className="right">{mtfInt ? <span style={{ color:'var(--gold)' }}>Rs{toINRd(mtfInt)}</span> : <span className="neutral">—</span>}</td>
                            <td className="right">{unrealisedPnL !== null ? <span style={{ color:unrealisedPnL>=0?'var(--bull)':'var(--bear)', fontWeight:600 }}>{unrealisedPnL>=0?'+':'−'}Rs{toINRd(Math.abs(unrealisedPnL))}</span> : <span className="neutral">—</span>}</td>
                            <td className="right">{realisedPnL !== 0 || trade.status==='CLOSED' ? <span style={{ color:realisedPnL>=0?'var(--bull)':'var(--bear)', fontWeight:600 }}>{realisedPnL>=0?'+':'−'}Rs{toINRd(Math.abs(realisedPnL))}</span> : <span className="neutral">—</span>}</td>
                            <td style={{ textAlign:'center', position:'relative' }} onClick={e => e.stopPropagation()}>
                              <button onClick={e => { e.preventDefault(); e.stopPropagation(); setOpenMenu(prev => prev===trade.id ? null : trade.id) }} style={{ background:'none', border:'1px solid var(--border)', borderRadius:'4px', padding:'4px 10px', cursor:'pointer', color:'var(--muted)', fontSize:'14px', letterSpacing:'2px' }}>···</button>
                              {openMenu === trade.id && (
                                <div onClick={e => e.stopPropagation()} style={{ position:'absolute', right:0, top:'100%', zIndex:100, background:'var(--bg)', border:'1px solid var(--border)', borderRadius:'8px', boxShadow:'0 8px 24px rgba(0,0,0,0.12)', minWidth:'130px', padding:'4px' }}>
                                  <button onClick={() => { setEditingTrade(trade); setOpenMenu(null) }} style={{ display:'block', width:'100%', padding:'8px 12px', background:'none', border:'none', textAlign:'left', cursor:'pointer', fontSize:'12px', color:'var(--text)', borderRadius:'5px', fontFamily:'DM Mono, monospace' }}>✏️ Edit</button>
                                  <button onClick={() => { handleDelete(trade.id); setOpenMenu(null) }} style={{ display:'block', width:'100%', padding:'8px 12px', background:'none', border:'none', textAlign:'left', cursor:'pointer', fontSize:'12px', color:'var(--bear)', borderRadius:'5px', fontFamily:'DM Mono, monospace' }}>🗑 Delete</button>
                                </div>
                              )}
                            </td>
                          </tr>
                          {expandedTrade === trade.id && (
                            <tr key={`exec-${trade.id}`}>
                              <td colSpan={14} style={{ padding:0, background:'var(--surface)', borderBottom:'2px solid var(--accent)' }}>
                                <ExecutionPanel trade={trade} executions={executions[trade.id]||[]} onAdd={(exec) => addExecution(trade.id, exec)} onDelete={(execId) => deleteExecution(execId, trade.id)} onAutoClose={(updates) => handleAutoClose(trade.id, updates)} />
                              </td>
                            </tr>
                          )}
                        </>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </main>

      {showAdd && <AddTradeModal session={session} onClose={() => setShowAdd(false)} onAdd={handleAddTrade} isAdmin={isAdmin} />}
      {editingTrade && <EditTradeModal trade={editingTrade} onClose={() => setEditingTrade(null)} onSave={handleEdit} session={session} isAdmin={isAdmin} />}
    </>
  )
}
