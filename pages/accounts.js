import { useState, useEffect, useCallback } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'
import { supabase } from '../lib/supabase'
import { differenceInDays } from 'date-fns'
import AddTradeModal from '../components/AddTradeModal'
import ExitTradeModal from '../components/ExitTradeModal'
import EditTradeModal from '../components/EditTradeModal'
import ExecutionPanel from '../components/ExecutionPanel'

function NavPill({ active }) {
  const router = useRouter()
  return (
    <div style={{ display:'flex', background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'8px', padding:'3px', gap:'2px' }}>
      {[{label:'Dashboard',path:'/dashboard'},{label:'Accounts',path:'/accounts'},{label:'Main Page',path:'/'}].map(({label,path}) => (
        <button key={path} onClick={() => router.push(path)} style={{ padding:'7px 22px', borderRadius:'6px', border:'none', cursor:'pointer', fontSize:'11px', fontFamily:'DM Mono, monospace', fontWeight:600, background:active===label?'var(--accent)':'transparent', color:active===label?'#fff':'var(--muted)' }}>{label}</button>
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
  const [exitingTrade, setExitingTrade] = useState(null)
  const [editingTrade, setEditingTrade] = useState(null)
  const [openMenu, setOpenMenu] = useState(null)
  const [expandedTrade, setExpandedTrade] = useState(null)
  const [executions, setExecutions] = useState({})
  const [showNewAccount, setShowNewAccount] = useState(false)
  const [newAccountName, setNewAccountName] = useState('')
  const [countdown, setCountdown] = useState(60)

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

  const getToken = async () => (await supabase.auth.getSession()).data.session?.access_token

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
    if (Array.isArray(tData)) setTrades(tData)
    if (Array.isArray(aData)) {
      setAccounts(aData)
      if (aData.length > 0 && !activeAccount) setActiveAccount(aData[0].name)
    }
    setLoading(false)
  }, [session]) // eslint-disable-line

  useEffect(() => { if (session) loadData() }, [session, loadData])

  const fetchPrice = useCallback(async (ticker) => {
    try {
      const token = await getToken()
      const res = await fetch(`/api/stock/${ticker}`, { headers:{ Authorization:`Bearer ${token}` } })
      const data = await res.json()
      if (data.price) setLivePrices(prev => ({ ...prev, [ticker]:data }))
    } catch {}
  }, [])

  useEffect(() => {
    if (!session || !activeAccount) return
    const symbols = [...new Set(trades.filter(t => t.status==='OPEN' && t.account===activeAccount).map(t => t.ticker))]
    symbols.forEach(fetchPrice)
  }, [trades, activeAccount, session]) // eslint-disable-line

  useEffect(() => {
    if (countdown===60 && session && activeAccount) {
      const symbols = [...new Set(trades.filter(t => t.status==='OPEN' && t.account===activeAccount).map(t => t.ticker))]
      symbols.forEach(fetchPrice)
    }
  }, [countdown]) // eslint-disable-line

  const fetchExecutions = async (tradeId) => {
    const token = await getToken()
    const res = await fetch(`/api/executions?trade_id=${tradeId}`, { headers:{ Authorization:`Bearer ${token}` } })
    const data = await res.json()
    if (Array.isArray(data)) setExecutions(prev => ({ ...prev, [tradeId]:data }))
  }

  const addExecution = async (tradeId, execution) => {
    const token = await getToken()
    await fetch('/api/executions', { method:'POST', headers:{ 'Content-Type':'application/json', Authorization:`Bearer ${token}` }, body:JSON.stringify({ trade_id:tradeId, ...execution }) })
    await fetchExecutions(tradeId)
  }

  const deleteExecution = async (execId, tradeId) => {
    const token = await getToken()
    await fetch('/api/executions', { method:'DELETE', headers:{ 'Content-Type':'application/json', Authorization:`Bearer ${token}` }, body:JSON.stringify({ id:execId }) })
    await fetchExecutions(tradeId)
  }

  const handleRowClick = (tradeId) => {
    if (expandedTrade === tradeId) { setExpandedTrade(null); return }
    setExpandedTrade(tradeId)
    if (!executions[tradeId]) fetchExecutions(tradeId)
  }

  const handleAddTrade = async (tradeData) => {
    const token = await getToken()
    const res = await fetch('/api/trades', { method:'POST', headers:{ 'Content-Type':'application/json', Authorization:`Bearer ${token}` }, body:JSON.stringify({ ...tradeData, account:activeAccount }) })
    const data = await res.json()
    if (data.error) throw new Error(data.error)
    await loadData()
  }

  const handleExit = async ({ exitPrice, exitQty, exitDate, realisedGain, remainingQty, isFullExit }) => {
    const token = await getToken()
    const trade = exitingTrade
    await fetch('/api/trades', { method:'PUT', headers:{ 'Content-Type':'application/json', Authorization:`Bearer ${token}` },
      body:JSON.stringify({ id:trade.id, status:'CLOSED', exit_price:exitPrice, exit_date:exitDate, quantity:exitQty, realized_gains:realisedGain }) })
    if (!isFullExit && remainingQty > 0) {
      await fetch('/api/trades', { method:'POST', headers:{ 'Content-Type':'application/json', Authorization:`Bearer ${token}` },
        body:JSON.stringify({ account:trade.account, ticker:trade.ticker, direction:trade.direction, entry_date:trade.entry_date, entry_price:trade.entry_price, quantity:remainingQty, invested_capital:trade.entry_price*remainingQty, mtf_interest_rate:trade.mtf_interest_rate, notes:trade.notes, status:'OPEN' }) })
    }
    setExitingTrade(null)
    await loadData()
  }

  const handleEdit = async (updates) => {
    const token = await getToken()
    await fetch('/api/trades', { method:'PUT', headers:{ 'Content-Type':'application/json', Authorization:`Bearer ${token}` }, body:JSON.stringify({ id:editingTrade.id, ...updates }) })
    setEditingTrade(null)
    await loadData()
  }

  const handleDelete = async (id) => {
    if (!confirm('Delete this trade?')) return
    const token = await getToken()
    await fetch('/api/trades', { method:'DELETE', headers:{ 'Content-Type':'application/json', Authorization:`Bearer ${token}` }, body:JSON.stringify({ id }) })
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
    await fetch('/api/accounts', { method:'DELETE', headers:{ 'Content-Type':'application/json', Authorization:`Bearer ${token}` }, body:JSON.stringify({ id:acc.id }) })
    setActiveAccount(accounts.find(a => a.name !== acc.name)?.name || null)
    await loadData()
  }

  const signOut = () => supabase.auth.signOut().then(() => router.push('/'))
  const toINR = (n) => Number(n||0).toLocaleString('en-IN', { maximumFractionDigits:0 })
  const toINRd = (n) => Number(n||0).toLocaleString('en-IN', { maximumFractionDigits:2 })

  const accountTrades = trades.filter(t => t.account === activeAccount)
  const filtered = accountTrades.filter(t => filter==='ALL' || t.status===filter)
  const openTrades = accountTrades.filter(t => t.status==='OPEN')
  const closedTrades = accountTrades.filter(t => t.status==='CLOSED')
  const totalRealised = closedTrades.reduce((s,t) => s+(t.realized_gains||0), 0)
  const totalMTF = accountTrades.reduce((s,t) => {
    if (!t.mtf_interest_rate || !t.entry_date || !t.invested_capital || !t.actual_investment) return s
    const base = t.invested_capital - t.actual_investment
    if (base <= 0) return s
    const end = t.status==='CLOSED' && t.exit_date ? new Date(t.exit_date) : new Date()
    return s + (base * t.mtf_interest_rate * Math.max(1, differenceInDays(end, new Date(t.entry_date)))) / 36500
  }, 0)

  if (!session) return null

  return (
    <>
      <Head><title>Accounts — CHiiRAG Stock Journal</title></Head>
      <header className="header">
        <NavPill active="Accounts" />
        <div style={{ fontFamily:'Bookman Old Style, serif', fontWeight:800, fontSize:'15px', color:'var(--text)' }}>CHiiRAG <span style={{ color:'var(--accent)' }}>STOCK Journal</span></div>
        <div style={{ display:'flex', gap:'8px', alignItems:'center' }}>
          {openTrades.length > 0 && <span style={{ fontSize:'10px', color:'var(--muted)' }}>↻ {countdown}s</span>}
          <button onClick={() => setShowAdd(true)} className="btn btn-primary" style={{ padding:'6px 14px', fontSize:'11px' }}>+ New Trade</button>
          <button onClick={signOut} className="btn btn-ghost" style={{ padding:'6px 10px', fontSize:'11px' }}>Sign Out</button>
        </div>
      </header>

      <main style={{ maxWidth:'1400px', margin:'0 auto', padding:'20px 16px' }}>

        {/* Account Tiles */}
        <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'20px', flexWrap:'wrap' }}>
          {accounts.map(acc => (
            <div key={acc.id} style={{ border:`2px solid ${activeAccount===acc.name?'var(--accent)':'var(--border)'}`, background:activeAccount===acc.name?'var(--accent-dim)':'var(--surface)', borderRadius:'10px', minWidth:'120px' }}>
              <button onClick={() => setActiveAccount(acc.name)} style={{ width:'100%', padding:'14px 16px 10px', background:'transparent', border:'none', cursor:'pointer', textAlign:'left' }}>
                <div style={{ fontSize:'14px', fontWeight:700, fontFamily:'DM Mono, monospace', color:activeAccount===acc.name?'var(--accent)':'var(--text)' }}>{acc.name}</div>
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
        </div>

        {loading ? <div style={{ textAlign:'center', padding:'60px', color:'var(--muted)' }}>Loading...</div>
        : !activeAccount ? <div style={{ textAlign:'center', padding:'80px', color:'var(--muted)' }}>No accounts yet.</div>
        : (
          <>
            {/* Stats */}
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(150px,1fr))', gap:'10px', marginBottom:'16px' }}>
              {[
                { label:'Realised P&L', value:`${totalRealised>=0?'+':'−'}₹${toINR(Math.abs(totalRealised))}`, color:totalRealised>=0?'var(--bull)':'var(--bear)' },
                { label:'Open Positions', value:openTrades.length, color:'var(--accent)' },
                { label:'Closed Trades', value:closedTrades.length },
                { label:'MTF Interest', value:`₹${toINRd(totalMTF)}`, color:'var(--gold)' },
              ].map(s => (
                <div key={s.label} className="stat-card">
                  <div style={{ fontSize:'9px', color:'var(--muted)', letterSpacing:'0.12em', textTransform:'uppercase', marginBottom:'6px' }}>{s.label}</div>
                  <div style={{ fontSize:'20px', fontWeight:700, fontFamily:'Bookman Old Style, serif', color:s.color||'var(--text)' }}>{s.value}</div>
                </div>
              ))}
            </div>

            {/* Filter */}
            <div style={{ display:'flex', gap:'6px', marginBottom:'14px' }}>
              {['ALL','OPEN','CLOSED'].map(f => (
                <button key={f} onClick={() => setFilter(f)} style={{ padding:'5px 14px', borderRadius:'4px', border:`1px solid ${filter===f?'var(--accent)':'var(--border)'}`, background:filter===f?'var(--accent-dim)':'transparent', color:filter===f?'var(--accent)':'var(--muted)', cursor:'pointer', fontSize:'10px', fontFamily:'DM Mono, monospace', fontWeight:600 }}>
                  {f} ({f==='ALL'?accountTrades.length:f==='OPEN'?openTrades.length:closedTrades.length})
                </button>
              ))}
            </div>

            {/* Table */}
            {filtered.length === 0 ? (
              <div style={{ textAlign:'center', padding:'60px', color:'var(--muted)', border:'1px dashed var(--border)', borderRadius:'8px' }}>No trades. Click "+ New Trade" to add one.</div>
            ) : (
              <div style={{ overflowX:'auto' }}>
                <table className="trade-table">
                  <thead>
                    <tr>
                      <th>Ticker</th><th>Direction</th><th>Entry Date</th>
                      <th className="right">Entry ₹</th><th className="right">CMP</th>
                      <th className="right">Exit ₹</th><th className="right">Qty</th>
                      <th className="right">Investment</th><th className="right">Actual Inv</th>
                      <th className="right">MTF Interest</th>
                      <th className="right">Unrealised P&L</th><th className="right">Realised P&L</th>
                      <th style={{ textAlign:'center' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(trade => {
                      const isOpen = trade.status === 'OPEN'
                      const lp = livePrices[trade.ticker]
                      const days = trade.entry_date ? Math.max(1, differenceInDays(new Date(), new Date(trade.entry_date))) : 0
                      const mtfBase = trade.invested_capital && trade.actual_investment ? trade.invested_capital - trade.actual_investment : null
                      const mtfDays = trade.status==='CLOSED' && trade.exit_date ? Math.max(1, differenceInDays(new Date(trade.exit_date), new Date(trade.entry_date))) : days
                      const mtfInt = mtfBase && mtfBase > 0 && trade.mtf_interest_rate ? (mtfBase * trade.mtf_interest_rate * mtfDays) / 36500 : null
                      const unr = isOpen && lp?.price && trade.entry_price && trade.quantity ? (trade.direction==='LONG' ? (lp.price-trade.entry_price)*trade.quantity : (trade.entry_price-lp.price)*trade.quantity) : null
                      return (
                        <>
                          <tr key={trade.id} className={isOpen?'row-open':'row-closed'} onClick={() => handleRowClick(trade.id)} style={{ cursor:'pointer' }}>
                            <td><span className="ticker-badge">{trade.ticker}</span></td>
                            <td><span className={`badge badge-${trade.direction.toLowerCase()}`}>{trade.direction}</span></td>
                            <td className="muted">{trade.entry_date?.slice(0,10)}</td>
                            <td className="right">₹{toINR(trade.entry_price)}</td>
                            <td className="right">
                              {isOpen && lp ? <div><div style={{ fontWeight:600 }}>₹{toINR(lp.price)}</div><div style={{ fontSize:'10px', color:lp.change>=0?'var(--bull)':'var(--bear)' }}>{lp.change>=0?'+':''}{lp.changePercent?.toFixed(2)}%</div></div> : <span className="neutral">—</span>}
                            </td>
                            <td className="right">{trade.exit_price ? `₹${toINR(trade.exit_price)}` : <span className="neutral">—</span>}</td>
                            <td className="right">{toINR(trade.quantity)}</td>
                            <td className="right">{trade.invested_capital ? `₹${toINR(trade.invested_capital)}` : <span className="neutral">—</span>}</td>
                            <td className="right">{trade.actual_investment ? `₹${toINR(trade.actual_investment)}` : <span className="neutral">—</span>}</td>
                            <td className="right">{mtfInt ? <span style={{ color:'var(--gold)' }}>₹{toINRd(mtfInt)}</span> : <span className="neutral">—</span>}</td>
                            <td className="right">{unr !== null ? <span style={{ color:unr>=0?'var(--bull)':'var(--bear)', fontWeight:600 }}>{unr>=0?'+':'−'}₹{toINR(Math.abs(unr))}</span> : <span className="neutral">—</span>}</td>
                            <td className="right">{trade.realized_gains != null ? <span style={{ color:trade.realized_gains>=0?'var(--bull)':'var(--bear)', fontWeight:600 }}>{trade.realized_gains>=0?'+':'−'}₹{toINR(Math.abs(trade.realized_gains))}</span> : <span className="neutral">—</span>}</td>
                            <td style={{ textAlign:'center', position:'relative' }} onClick={e => e.stopPropagation()}>
                              <button onClick={e => { e.preventDefault(); e.stopPropagation(); setOpenMenu(prev => prev===trade.id ? null : trade.id) }} style={{ background:'none', border:'1px solid var(--border)', borderRadius:'4px', padding:'4px 10px', cursor:'pointer', color:'var(--muted)', fontSize:'14px', letterSpacing:'2px' }}>···</button>
                              {openMenu === trade.id && (
                                <div onClick={e => e.stopPropagation()} style={{ position:'absolute', right:0, top:'100%', zIndex:100, background:'var(--bg)', border:'1px solid var(--border)', borderRadius:'8px', boxShadow:'0 8px 24px rgba(0,0,0,0.12)', minWidth:'130px', padding:'4px' }}>
                                  <button onClick={() => { setEditingTrade(trade); setOpenMenu(null) }} style={{ display:'block', width:'100%', padding:'8px 12px', background:'none', border:'none', textAlign:'left', cursor:'pointer', fontSize:'12px', color:'var(--text)', borderRadius:'5px', fontFamily:'DM Mono, monospace' }}>✏️ Edit</button>
                                  {isOpen && <button onClick={() => { setExitingTrade(trade); setOpenMenu(null) }} style={{ display:'block', width:'100%', padding:'8px 12px', background:'none', border:'none', textAlign:'left', cursor:'pointer', fontSize:'12px', color:'var(--bull)', borderRadius:'5px', fontFamily:'DM Mono, monospace' }}>↗ Exit</button>}
                                  <button onClick={() => { handleDelete(trade.id); setOpenMenu(null) }} style={{ display:'block', width:'100%', padding:'8px 12px', background:'none', border:'none', textAlign:'left', cursor:'pointer', fontSize:'12px', color:'var(--bear)', borderRadius:'5px', fontFamily:'DM Mono, monospace' }}>🗑 Delete</button>
                                </div>
                              )}
                            </td>
                          </tr>
                          {expandedTrade === trade.id && (
                            <tr key={`exec-${trade.id}`}>
                              <td colSpan={13} style={{ padding:0, background:'var(--surface)', borderBottom:'2px solid var(--accent)' }}>
                                <ExecutionPanel trade={trade} executions={executions[trade.id]||[]} onAdd={(exec) => addExecution(trade.id, exec)} onDelete={(execId) => deleteExecution(execId, trade.id)} />
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

      {showAdd && <AddTradeModal session={session} onClose={() => setShowAdd(false)} onAdd={handleAddTrade} />}
      {exitingTrade && <ExitTradeModal trade={exitingTrade} onClose={() => setExitingTrade(null)} onConfirm={handleExit} />}
      {editingTrade && <EditTradeModal trade={editingTrade} onClose={() => setEditingTrade(null)} onSave={handleEdit} />}
    </>
  )
}
