import { useState, useEffect, useCallback } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'
import { supabase } from '../lib/supabase'
import AddTradeModal from '../components/AddTradeModal'
import { differenceInDays } from 'date-fns'
import ExecutionPanel from '../components/ExecutionPanel'

function NavPill({ active }) {
  const router = useRouter()
  return (
    <div style={{ display:'flex', background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'8px', padding:'3px', gap:'2px' }}>
      {[{ label:'Dashboard', path:'/dashboard' },{ label:'Accounts', path:'/accounts' },{ label:'Main Page', path:'/' }].map(({ label, path }) => (
        <button key={path} onClick={() => router.push(path)} style={{
          padding:'7px 22px', borderRadius:'6px', border:'none', cursor:'pointer',
          fontSize:'11px', fontFamily:'DM Mono, monospace', fontWeight:600, letterSpacing:'0.05em',
          background:active===label?'var(--accent)':'transparent',
          color:active===label?'#fff':'var(--muted)', transition:'all 0.15s',
        }}>{label}</button>
      ))}
    </div>
  )
}

// ── Exit Modal ─────────────────────────────────────────────────────────────────
function ExitModal({ trade, onClose, onConfirm }) {
  const [exitPrice, setExitPrice] = useState('')
  const [exitQty, setExitQty] = useState('')
  const [exitDate, setExitDate] = useState(new Date().toISOString().slice(0,10))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const entryPrice = parseFloat(trade.entry_price)||0
  const totalQty = parseFloat(trade.quantity)||0
  const exitPriceNum = parseFloat(exitPrice)||0
  const exitQtyNum = parseFloat(exitQty)||0
  const remainingQty = totalQty - exitQtyNum
  const isFullExit = exitQtyNum >= totalQty

  const realisedGain = exitPriceNum && exitQtyNum
    ? trade.direction==='LONG' ? (exitPriceNum-entryPrice)*exitQtyNum : (entryPrice-exitPriceNum)*exitQtyNum
    : null
  const unrealisedGain = exitPriceNum && exitQtyNum && remainingQty>0
    ? trade.direction==='LONG' ? (exitPriceNum-entryPrice)*remainingQty : (entryPrice-exitPriceNum)*remainingQty
    : null

  const fmt = (n) => Math.abs(n).toLocaleString('en-IN',{maximumFractionDigits:2})
  const fld = { width:'100%', background:'var(--surface2)', border:'1px solid var(--border)', borderRadius:'6px', padding:'9px 12px', color:'var(--text)', fontSize:'13px', fontFamily:'DM Mono, monospace', outline:'none', boxSizing:'border-box' }
  const lbl = { fontSize:'11px', color:'var(--muted)', fontWeight:600, letterSpacing:'0.08em', marginBottom:'5px', display:'block', textTransform:'uppercase' }

  const submit = async () => {
    setError('')
    if (!exitPrice || !exitQty || !exitDate) return setError('All fields required')
    if (exitQtyNum<=0) return setError('Quantity must be greater than 0')
    if (exitQtyNum>totalQty) return setError(`Max quantity is ${totalQty}`)
    setLoading(true)
    try { await onConfirm({ exitPriceNum, exitQtyNum, exitDate, realisedGain, remainingQty, isFullExit }); onClose() }
    catch(err) { setError(err.message) }
    finally { setLoading(false) }
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.4)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000, padding:'16px' }} onClick={e => e.target===e.currentTarget && onClose()}>
      <div style={{ background:'var(--bg)', border:'1px solid var(--border)', borderRadius:'12px', padding:'28px', width:'100%', maxWidth:'440px', boxShadow:'0 20px 60px rgba(0,0,0,0.15)' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'20px' }}>
          <div>
            <div style={{ fontFamily:'Bookman Old Style, serif', fontWeight:700, fontSize:'18px', color:'var(--text)' }}>Exit Trade</div>
            <div style={{ fontSize:'11px', color:'var(--muted)', marginTop:'2px' }}>{trade.ticker} · {trade.direction} · {totalQty} shares @ ₹{entryPrice.toLocaleString('en-IN')}</div>
          </div>
          <button onClick={onClose} style={{ background:'none', border:'none', fontSize:'20px', color:'var(--muted)', cursor:'pointer' }}>×</button>
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:'14px' }}>
          <div><label style={lbl}>Exit Price ₹ *</label><input type="number" value={exitPrice} onChange={e=>setExitPrice(e.target.value)} placeholder="Enter exit price" style={fld} autoFocus /></div>
          <div><label style={lbl}>Exit Quantity * (max: {totalQty})</label><input type="number" value={exitQty} onChange={e=>setExitQty(e.target.value)} placeholder={`Max ${totalQty}`} style={fld} /></div>
          <div><label style={lbl}>Exit Date *</label><input type="date" value={exitDate} onChange={e=>setExitDate(e.target.value)} style={fld} /></div>
        </div>
        {exitPriceNum>0 && exitQtyNum>0 && (
          <div style={{ marginTop:'16px', background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'8px', padding:'14px' }}>
            <div style={{ fontSize:'10px', color:'var(--muted)', letterSpacing:'0.1em', fontWeight:600, marginBottom:'10px' }}>P&L PREVIEW</div>
            <div style={{ display:'flex', flexDirection:'column', gap:'6px', fontSize:'13px', fontFamily:'DM Mono, monospace' }}>
              <div style={{ display:'flex', justifyContent:'space-between' }}>
                <span style={{ color:'var(--muted)' }}>Realised ({exitQtyNum} shares)</span>
                <span style={{ fontWeight:700, color:realisedGain>=0?'var(--bull)':'var(--bear)' }}>{realisedGain>=0?'+':'−'}₹{fmt(realisedGain)}</span>
              </div>
              {!isFullExit && unrealisedGain!==null && (
                <div style={{ display:'flex', justifyContent:'space-between' }}>
                  <span style={{ color:'var(--muted)' }}>Unrealised ({remainingQty} remaining)</span>
                  <span style={{ fontWeight:700, color:unrealisedGain>=0?'var(--bull)':'var(--bear)' }}>{unrealisedGain>=0?'+':'−'}₹{fmt(unrealisedGain)}</span>
                </div>
              )}
              <div style={{ display:'flex', justifyContent:'space-between', paddingTop:'6px', borderTop:'1px solid var(--border)' }}>
                <span style={{ color:'var(--muted)' }}>Type</span>
                <span style={{ fontWeight:700, color:isFullExit?'var(--bear)':'var(--accent)' }}>{isFullExit?'Full Exit':'Partial Exit'}</span>
              </div>
            </div>
          </div>
        )}
        {error && <div style={{ color:'var(--bear)', fontSize:'12px', marginTop:'10px' }}>{error}</div>}
        <div style={{ display:'flex', gap:'10px', marginTop:'20px' }}>
          <button onClick={onClose} style={{ flex:1, padding:'10px', background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'6px', color:'var(--muted)', cursor:'pointer', fontSize:'13px' }}>Cancel</button>
          <button onClick={submit} disabled={loading} style={{ flex:2, padding:'10px', borderRadius:'6px', border:'none', background:'var(--accent)', color:'#fff', fontWeight:700, fontSize:'13px', cursor:'pointer' }}>
            {loading?'Saving...':isFullExit?'Confirm Full Exit':'Confirm Partial Exit'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Edit Modal ─────────────────────────────────────────────────────────────────
function EditModal({ trade, onClose, onSave }) {
  const [form, setForm] = useState({
    ticker: trade.ticker||'', direction: trade.direction||'LONG',
    entry_date: trade.entry_date?.slice(0,10)||'', entry_price: trade.entry_price||'',
    quantity: trade.quantity||'', mtf_value: trade.mtf_value||'',
    mtf_interest_rate: trade.mtf_interest_rate||'', notes: trade.notes||'',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const set = (k,v) => setForm(f=>({...f,[k]:v}))
  const investedCapital = form.entry_price && form.quantity ? parseFloat(form.entry_price)*parseFloat(form.quantity) : null
  const fld = { width:'100%', background:'var(--surface2)', border:'1px solid var(--border)', borderRadius:'6px', padding:'9px 12px', color:'var(--text)', fontSize:'13px', fontFamily:'DM Mono, monospace', outline:'none', boxSizing:'border-box' }
  const lbl = { fontSize:'11px', color:'var(--muted)', fontWeight:600, letterSpacing:'0.08em', marginBottom:'5px', display:'block', textTransform:'uppercase' }
  const sec = { fontSize:'10px', color:'var(--accent)', fontWeight:700, letterSpacing:'0.12em', textTransform:'uppercase', borderBottom:'1px solid var(--border)', paddingBottom:'6px', marginBottom:'12px', marginTop:'20px' }

  const submit = async () => {
    setError('')
    if (!form.ticker.trim()) return setError('Ticker required')
    if (!form.entry_price || !form.quantity || !form.entry_date) return setError('Entry price, quantity and date required')
    setLoading(true)
    try {
      await onSave({ ticker:form.ticker.toUpperCase().trim(), direction:form.direction, entry_date:form.entry_date, entry_price:parseFloat(form.entry_price), quantity:parseFloat(form.quantity), invested_capital:investedCapital, mtf_value:form.mtf_value?parseFloat(form.mtf_value):null, mtf_interest_rate:form.mtf_interest_rate?parseFloat(form.mtf_interest_rate):null, notes:form.notes||null })
      onClose()
    } catch(err) { setError(err.message) }
    finally { setLoading(false) }
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.4)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000, padding:'16px' }} onClick={e => e.target===e.currentTarget && onClose()}>
      <div style={{ background:'var(--bg)', border:'1px solid var(--border)', borderRadius:'12px', padding:'28px', width:'100%', maxWidth:'540px', maxHeight:'90vh', overflowY:'auto', boxShadow:'0 20px 60px rgba(0,0,0,0.15)' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'20px' }}>
          <div><div style={{ fontFamily:'Bookman Old Style, serif', fontWeight:700, fontSize:'18px', color:'var(--text)' }}>Edit Trade</div>
          <div style={{ fontSize:'11px', color:'var(--muted)', marginTop:'2px' }}>{trade.ticker} · {trade.account}</div></div>
          <button onClick={onClose} style={{ background:'none', border:'none', fontSize:'20px', color:'var(--muted)', cursor:'pointer' }}>×</button>
        </div>

        <div style={sec}>Trade Info</div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px' }}>
          <div style={{ gridColumn:'1/-1' }}><label style={lbl}>Ticker *</label><input value={form.ticker} onChange={e=>set('ticker',e.target.value)} style={{ ...fld, textTransform:'uppercase' }} /></div>
          <div style={{ gridColumn:'1/-1' }}>
            <label style={lbl}>Direction *</label>
            <div style={{ display:'flex', gap:'8px' }}>
              {['LONG','SHORT'].map(d => (
                <button key={d} onClick={()=>set('direction',d)} style={{ flex:1, padding:'8px', borderRadius:'6px', cursor:'pointer', border:`1px solid ${form.direction===d?(d==='LONG'?'var(--bull)':'var(--bear)'):'var(--border)'}`, background:form.direction===d?(d==='LONG'?'rgba(22,163,74,0.1)':'rgba(220,38,38,0.1)'):'var(--surface2)', color:form.direction===d?(d==='LONG'?'var(--bull)':'var(--bear)'):'var(--muted)', fontWeight:700, fontSize:'12px', fontFamily:'DM Mono, monospace' }}>
                  {d==='LONG'?'▲ LONG':'▼ SHORT'}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div style={sec}>Entry Details</div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'12px' }}>
          <div><label style={lbl}>Entry Date *</label><input type="date" value={form.entry_date} onChange={e=>set('entry_date',e.target.value)} style={fld} /></div>
          <div><label style={lbl}>Entry Price ₹ *</label><input type="number" value={form.entry_price} onChange={e=>set('entry_price',e.target.value)} placeholder="0.00" style={fld} /></div>
          <div><label style={lbl}>Quantity *</label><input type="number" value={form.quantity} onChange={e=>set('quantity',e.target.value)} placeholder="100" style={fld} /></div>
        </div>
        {investedCapital && <div style={{ marginTop:'10px', padding:'8px 12px', background:'var(--surface)', borderRadius:'6px', border:'1px solid var(--border)', display:'flex', justifyContent:'space-between' }}><span style={{ fontSize:'10px', color:'var(--muted)', textTransform:'uppercase', letterSpacing:'0.1em' }}>Invested Capital</span><span style={{ color:'var(--accent)', fontWeight:600 }}>₹{investedCapital.toLocaleString('en-IN')}</span></div>}

        <div style={sec}>MTF Details <span style={{ color:'var(--muted)', fontWeight:400, fontSize:'10px', textTransform:'none' }}>(optional)</span></div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px' }}>
          <div><label style={lbl}>MTF Value ₹</label><input type="number" value={form.mtf_value} onChange={e=>set('mtf_value',e.target.value)} placeholder="MTF amount" style={fld} /></div>
          <div><label style={lbl}>MTF Rate % p.a.</label><input type="number" value={form.mtf_interest_rate} onChange={e=>set('mtf_interest_rate',e.target.value)} placeholder="e.g. 18" style={fld} /></div>
        </div>

        <div style={sec}>Notes</div>
        <textarea value={form.notes} onChange={e=>set('notes',e.target.value)} placeholder="Trade notes..." rows={3} style={{ ...fld, resize:'vertical' }} />

        {error && <div style={{ color:'var(--bear)', fontSize:'12px', marginTop:'10px' }}>{error}</div>}
        <div style={{ display:'flex', gap:'10px', marginTop:'20px' }}>
          <button onClick={onClose} style={{ flex:1, padding:'10px', background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'6px', color:'var(--muted)', cursor:'pointer', fontSize:'13px' }}>Cancel</button>
          <button onClick={submit} disabled={loading} style={{ flex:2, padding:'10px', borderRadius:'6px', border:'none', background:'var(--accent)', color:'#fff', fontWeight:700, fontSize:'13px', cursor:'pointer' }}>{loading?'Saving...':'Save Changes'}</button>
        </div>
      </div>
    </div>
  )
}



// ── Main Page ──────────────────────────────────────────────────────────────────
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

  const getToken = async () => (await supabase.auth.getSession()).data.session?.access_token

  const fetchExecutions = async (tradeId) => {
    const token = await getToken()
    const res = await fetch(`/api/executions?trade_id=${tradeId}`, { headers:{ Authorization:`Bearer ${token}` } })
    const data = await res.json()
    if (Array.isArray(data)) setExecutions(prev => ({ ...prev, [tradeId]: data }))
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

  const loadData = useCallback(async () => {
    if (!session) return
    setLoading(true)
    const token = await getToken()
    const [tRes, aRes] = await Promise.all([
      fetch('/api/trades', { headers:{ Authorization:`Bearer ${token}` } }),
      fetch('/api/accounts', { headers:{ Authorization:`Bearer ${token}` } }),
    ])
    const tData = await tRes.json(); const aData = await aRes.json()
    if (Array.isArray(tData)) setTrades(tData)
    if (Array.isArray(aData)) { setAccounts(aData); if (aData.length>0 && !activeAccount) setActiveAccount(aData[0].name) }
    setLoading(false)
  }, [session])

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
  }, [trades, activeAccount, session])

  useEffect(() => { const t = setInterval(() => setCountdown(c => c<=1?60:c-1), 1000); return ()=>clearInterval(t) }, [])

  useEffect(() => {
    const handleClickOutside = () => setOpenMenu(null)
    document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [])
  useEffect(() => { if (countdown===60 && session && activeAccount) { const s=[...new Set(trades.filter(t=>t.status==='OPEN'&&t.account===activeAccount).map(t=>t.ticker))]; s.forEach(fetchPrice) } }, [countdown])

  const handleAddTrade = async (tradeData) => {
    const token = await getToken()
    const res = await fetch('/api/trades', { method:'POST', headers:{ 'Content-Type':'application/json', Authorization:`Bearer ${token}` }, body:JSON.stringify({ ...tradeData, account:activeAccount }) })
    const data = await res.json(); if (data.error) throw new Error(data.error)
    await loadData()
  }

  const handleEdit = async (updates) => {
    const token = await getToken()
    await fetch('/api/trades', { method:'PUT', headers:{ 'Content-Type':'application/json', Authorization:`Bearer ${token}` }, body:JSON.stringify({ id:editingTrade.id, ...updates }) })
    await loadData()
  }

  const handleExit = async ({ exitPriceNum, exitQtyNum, exitDate, realisedGain, remainingQty, isFullExit }) => {
    const token = await getToken(); const trade = exitingTrade
    if (isFullExit) {
      // Full exit — close the trade completely
      await fetch('/api/trades', { method:'PUT', headers:{ 'Content-Type':'application/json', Authorization:`Bearer ${token}` },
        body:JSON.stringify({ id:trade.id, status:'CLOSED', exit_price:exitPriceNum, exit_date:exitDate, quantity:exitQtyNum, realized_gains:realisedGain }) })
    } else {
      // Partial exit — update same row: remaining qty, keep OPEN, store realised gain, store exit info
      const unrealisedGain = trade.direction==='LONG'
        ? (exitPriceNum - trade.entry_price) * remainingQty
        : (trade.entry_price - exitPriceNum) * remainingQty
      await fetch('/api/trades', { method:'PUT', headers:{ 'Content-Type':'application/json', Authorization:`Bearer ${token}` },
        body:JSON.stringify({
          id: trade.id,
          quantity: remainingQty,
          invested_capital: trade.entry_price * remainingQty,
          exit_price: exitPriceNum,
          exit_date: exitDate,
          realized_gains: (trade.realized_gains || 0) + realisedGain,
          status: 'OPEN',
        }) })
    }
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

  const handleDeleteAccount = async (accountName) => {
    if (!confirm(`Delete account "${accountName}"? All trades will also be deleted.`)) return
    const token = await getToken(); const acc = accounts.find(a => a.name===accountName)
    if (acc) await fetch('/api/accounts', { method:'DELETE', headers:{ 'Content-Type':'application/json', Authorization:`Bearer ${token}` }, body:JSON.stringify({ id:acc.id }) })
    setActiveAccount(accounts.find(a=>a.name!==accountName)?.name||null); await loadData()
  }

  const signOut = () => supabase.auth.signOut().then(() => router.push('/'))
  const toINR = (n) => Number(n||0).toLocaleString('en-IN',{maximumFractionDigits:0})
  const toINRd = (n) => Number(n||0).toLocaleString('en-IN',{maximumFractionDigits:2})

  const accountTrades = trades.filter(t => t.account===activeAccount)
  const filtered = accountTrades.filter(t => filter==='ALL' || t.status===filter)
  const openTrades = accountTrades.filter(t => t.status==='OPEN')
  const closedTrades = accountTrades.filter(t => t.status==='CLOSED')
  const totalRealised = closedTrades.reduce((s,t) => s+(t.realized_gains||0), 0)
  const totalMTF = openTrades.reduce((s,t) => {
    if (!t.mtf_interest_rate||!t.entry_date||!t.invested_capital||!t.actual_investment) return s
    const mtfBase2 = t.invested_capital - t.actual_investment
    if (mtfBase2<=0) return s
    const endDate = t.status==='CLOSED'&&t.exit_date ? new Date(t.exit_date) : new Date()
    return s+(mtfBase2*t.mtf_interest_rate*Math.max(1,differenceInDays(endDate,new Date(t.entry_date))))/36500
  }, 0)

  if (!session) return null

  return (
    <>
      <Head><title>Accounts — CHiiRAG Stock Journal</title></Head>
      <header className="header">
        <NavPill active="Accounts" />
        <div style={{ fontFamily:'Bookman Old Style, serif', fontWeight:800, fontSize:'15px', color:'var(--text)' }}>CHiiRAG <span style={{ color:'var(--accent)' }}>STOCK Journal</span></div>
        <div style={{ display:'flex', gap:'8px', alignItems:'center' }}>
          {openTrades.length>0 && <span style={{ fontSize:'10px', color:'var(--muted)' }}>↻ {countdown}s</span>}
          <button onClick={() => setShowAdd(true)} className="btn btn-primary" style={{ padding:'6px 14px', fontSize:'11px' }}>+ New Trade</button>
          <button onClick={signOut} className="btn btn-ghost" style={{ padding:'6px 10px', fontSize:'11px' }}>Sign Out</button>
        </div>
      </header>

      <main style={{ maxWidth:'1400px', margin:'0 auto', padding:'20px 16px' }}>

        {/* Account Tabs */}
        <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'20px', flexWrap:'wrap' }}>
          {accounts.map(acc => (
            <div key={acc.id} style={{ border:`2px solid ${activeAccount===acc.name?'var(--accent)':'var(--border)'}`, background:activeAccount===acc.name?'var(--accent-dim)':'var(--surface)', borderRadius:'10px', minWidth:'120px', transition:'all 0.15s' }}>
              <button onClick={() => setActiveAccount(acc.name)} style={{ width:'100%', padding:'14px 16px 10px', background:'transparent', border:'none', cursor:'pointer', textAlign:'left' }}>
                <div style={{ fontSize:'14px', fontWeight:700, letterSpacing:'0.1em', fontFamily:'DM Mono, monospace', color:activeAccount===acc.name?'var(--accent)':'var(--text)' }}>{acc.name}</div>
                <div style={{ fontSize:'10px', color:'var(--muted)', marginTop:'3px' }}>{trades.filter(t=>t.account===acc.name).length} trades</div>
              </button>
              <div style={{ display:'flex', borderTop:'1px solid var(--border)' }}>
                <button onClick={() => { const n=prompt('Rename:',acc.name); if(n&&n.trim()) { getToken().then(token=>fetch('/api/accounts',{method:'PUT',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify({id:acc.id,name:n.trim().toUpperCase()})}).then(()=>loadData())) }}} style={{ flex:1, padding:'6px', background:'none', border:'none', borderRight:'1px solid var(--border)', color:'var(--muted)', cursor:'pointer', fontSize:'11px' }}>✎</button>
                <button onClick={() => handleDeleteAccount(acc.name)} style={{ flex:1, padding:'6px', background:'none', border:'none', color:'var(--muted)', cursor:'pointer', fontSize:'13px' }}>🗑</button>
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
        : !activeAccount ? <div style={{ textAlign:'center', padding:'80px', color:'var(--muted)' }}>No accounts yet. Click "+ New Account"</div>
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

            {/* Trade Table */}
            {filtered.length===0 ? (
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
                      const lp = livePrices[trade.ticker]
                      const days = trade.entry_date ? Math.max(1,differenceInDays(new Date(),new Date(trade.entry_date))) : 0
                      const mtfBase = trade.invested_capital && trade.actual_investment ? trade.invested_capital - trade.actual_investment : null
                      const mtfDays = trade.status==='CLOSED'&&trade.exit_date ? Math.max(1,differenceInDays(new Date(trade.exit_date),new Date(trade.entry_date))) : days
                      const mtfInt = mtfBase && mtfBase>0 && trade.mtf_interest_rate ? (mtfBase*trade.mtf_interest_rate*mtfDays)/36500 : null
                      const unr = isOpen&&lp?.price&&trade.entry_price&&trade.quantity ? (trade.direction==='LONG'?(lp.price-trade.entry_price)*trade.quantity:(trade.entry_price-lp.price)*trade.quantity) : null
                      return (
                        <>
                        <tr key={trade.id} className={isOpen?'row-open':'row-closed'} onClick={() => handleRowClick(trade.id)} style={{ cursor:'pointer' }}>
                          <td><span className="ticker-badge">{trade.ticker}</span></td>
                          <td><span className={`badge badge-${trade.direction.toLowerCase()}`}>{trade.direction}</span></td>
                          <td className="muted">{trade.entry_date?.slice(0,10)}</td>
                          <td className="right">₹{toINR(trade.entry_price)}</td>
                          <td className="right">
                            {isOpen&&lp ? <div><div style={{ fontWeight:600 }}>₹{toINR(lp.price)}</div><div style={{ fontSize:'10px', color:lp.change>=0?'var(--bull)':'var(--bear)' }}>{lp.change>=0?'+':''}{lp.changePercent?.toFixed(2)}%</div></div> : <span className="neutral">—</span>}
                          </td>
                          <td className="right">{trade.exit_price?`₹${toINR(trade.exit_price)}`:<span className="neutral">—</span>}</td>
                          <td className="right">{toINR(trade.quantity)}</td>
                          <td className="right">{trade.invested_capital?`₹${toINR(trade.invested_capital)}`:<span className="neutral">—</span>}</td>
                          <td className="right">{trade.actual_investment?`₹${toINR(trade.actual_investment)}`:<span className="neutral">—</span>}</td>
                          <td className="right">{mtfInt?<span style={{ color:'var(--gold)' }}>₹{toINRd(mtfInt)}</span>:<span className="neutral">—</span>}</td>
                          <td className="right">{unr!==null?<span style={{ color:unr>=0?'var(--bull)':'var(--bear)', fontWeight:600 }}>{unr>=0?'+':'−'}₹{toINR(Math.abs(unr))}</span>:<span className="neutral">—</span>}</td>
                          <td className="right">{trade.realized_gains!=null?<span style={{ color:trade.realized_gains>=0?'var(--bull)':'var(--bear)', fontWeight:600 }}>{trade.realized_gains>=0?'+':'−'}₹{toINR(Math.abs(trade.realized_gains))}</span>:<span className="neutral">—</span>}</td>
                          <td style={{ textAlign:'center', position:'relative' }} onClick={e=>e.stopPropagation()}>
                            <button onClick={e=>{e.preventDefault();e.stopPropagation();setOpenMenu(prev=>prev===trade.id?null:trade.id)}} style={{ background:'none', border:'1px solid var(--border)', borderRadius:'4px', padding:'4px 10px', cursor:'pointer', color:'var(--muted)', fontSize:'14px', letterSpacing:'2px' }}>···</button>
                            {openMenu===trade.id && (
                              <div onClick={e=>e.stopPropagation()} style={{ position:'absolute', right:0, top:'100%', zIndex:100, background:'var(--bg)', border:'1px solid var(--border)', borderRadius:'8px', boxShadow:'0 8px 24px rgba(0,0,0,0.12)', minWidth:'130px', padding:'4px' }}>
                                <button onClick={()=>{setEditingTrade(trade);setOpenMenu(null)}} style={{ display:'block', width:'100%', padding:'8px 12px', background:'none', border:'none', textAlign:'left', cursor:'pointer', fontSize:'12px', color:'var(--text)', borderRadius:'5px', fontFamily:'DM Mono, monospace' }}>✏️ Edit</button>
                                {isOpen && <button onClick={()=>{setExitingTrade(trade);setOpenMenu(null)}} style={{ display:'block', width:'100%', padding:'8px 12px', background:'none', border:'none', textAlign:'left', cursor:'pointer', fontSize:'12px', color:'var(--bull)', borderRadius:'5px', fontFamily:'DM Mono, monospace' }}>↗ Exit</button>}
                                <button onClick={()=>{handleDelete(trade.id);setOpenMenu(null)}} style={{ display:'block', width:'100%', padding:'8px 12px', background:'none', border:'none', textAlign:'left', cursor:'pointer', fontSize:'12px', color:'var(--bear)', borderRadius:'5px', fontFamily:'DM Mono, monospace' }}>🗑 Delete</button>
                              </div>
                            )}
                          </td>
                        </tr>
                          {expandedTrade===trade.id && (
                            <tr key={`exec-${trade.id}`}>
                              <td colSpan={13} style={{ padding:0, background:'var(--surface)', borderBottom:'2px solid var(--accent)' }}>
                                <ExecutionPanel
                                  trade={trade}
                                  executions={executions[trade.id]||[]}
                                  onAdd={(exec) => addExecution(trade.id, exec)}
                                  onDelete={(execId) => deleteExecution(execId, trade.id)}
                                />
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

      {showAdd && <AddTradeModal session={session} accounts={accounts} defaultAccount={activeAccount} onClose={() => setShowAdd(false)} onAdd={handleAddTrade} />}
      {exitingTrade && <ExitModal trade={exitingTrade} onClose={() => setExitingTrade(null)} onConfirm={handleExit} />}
      {editingTrade && <EditModal trade={editingTrade} onClose={() => setEditingTrade(null)} onSave={handleEdit} />}
    </>
  )
}


