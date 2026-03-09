import { useState, useEffect } from 'react'

const DEFAULT_STRATEGIES = ['VCP CONTRACTION', 'IPO', 'TIPS', 'OTHER']

const EMPTY = {
  account: '',
  ticker: '',
  direction: 'LONG',
  entry_date: new Date().toISOString().slice(0, 10),
  entry_price: '',
  quantity: '',
  actual_investment: '',
  mtf_interest_rate: '',
  strategy: '',
  notes: '',
}

export default function AddTradeModal({ session, onClose, onAdd, isAdmin }) {
  const [form, setForm] = useState(EMPTY)
  const [accounts, setAccounts] = useState([])
  const [newAccount, setNewAccount] = useState('')
  const [showAddAccount, setShowAddAccount] = useState(false)
  const [loading, setLoading] = useState(false)
  const [accountLoading, setAccountLoading] = useState(false)
  const [error, setError] = useState('')
  const [suggestions, setSuggestions] = useState([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [searchLoading, setSearchLoading] = useState(false)
  const [strategies, setStrategies] = useState(DEFAULT_STRATEGIES)
  const [showManageStrategies, setShowManageStrategies] = useState(false)
  const [newStrategy, setNewStrategy] = useState('')
  const [strategyLoading, setStrategyLoading] = useState(false)

  // Auto-calc total buying value
  const totalBuyingValue = form.entry_price && form.quantity
    ? parseFloat(form.entry_price) * parseFloat(form.quantity)
    : null

  // MTF borrowed amount = total - margin paid
  const mtfBorrowed = totalBuyingValue && form.actual_investment
    ? totalBuyingValue - parseFloat(form.actual_investment)
    : null

  // Daily interest on borrowed amount
  const dailyInterest = mtfBorrowed && mtfBorrowed > 0 && form.mtf_interest_rate
    ? (mtfBorrowed * parseFloat(form.mtf_interest_rate)) / 36500
    : null

  useEffect(() => { fetchAccounts(); fetchStrategies() }, [])

  const getToken = () => session?.access_token

  const fetchAccounts = async () => {
    const token = getToken()
    if (!token) return
    const res = await fetch('/api/accounts', { headers: { Authorization: `Bearer ${token}` } })
    const data = await res.json()
    if (Array.isArray(data)) setAccounts(data)
  }

  const fetchStrategies = async () => {
    const token = getToken()
    if (!token) return
    try {
      const res = await fetch('/api/strategies', { headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      if (Array.isArray(data)) setStrategies(data)
    } catch { setStrategies(DEFAULT_STRATEGIES) }
  }

  const handleAddAccount = async () => {
    if (!newAccount.trim()) return
    setAccountLoading(true)
    const res = await fetch('/api/accounts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
      body: JSON.stringify({ name: newAccount }),
    })
    const data = await res.json()
    if (data.id) {
      await fetchAccounts()
      setForm(f => ({ ...f, account: data.name }))
      setNewAccount('')
      setShowAddAccount(false)
    }
    setAccountLoading(false)
  }

  const handleDeleteAccount = async (id) => {
    await fetch('/api/accounts', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
      body: JSON.stringify({ id }),
    })
    await fetchAccounts()
  }

  const handleAddStrategy = async () => {
    if (!newStrategy.trim()) return
    setStrategyLoading(true)
    const res = await fetch('/api/strategies', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
      body: JSON.stringify({ name: newStrategy }),
    })
    if (res.ok) { await fetchStrategies(); setNewStrategy('') }
    setStrategyLoading(false)
  }

  const handleDeleteStrategy = async (name) => {
    await fetch('/api/strategies', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
      body: JSON.stringify({ name }),
    })
    await fetchStrategies()
  }

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const searchTicker = async (query) => {
    set('ticker', query)
    if (query.length < 2) { setSuggestions([]); setShowSuggestions(false); return }
    setSearchLoading(true)
    try {
      const res = await fetch(`/api/ticker-search?q=${encodeURIComponent(query)}`)
      const data = await res.json()
      setSuggestions(Array.isArray(data) ? data : [])
      setShowSuggestions(true)
    } catch { setSuggestions([]) }
    setSearchLoading(false)
  }

  const selectTicker = (item) => {
    set('ticker', item.ticker)
    setSuggestions([])
    setShowSuggestions(false)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (!form.account) return setError('Select an account')
    if (!form.ticker.trim()) return setError('Enter a ticker symbol')
    if (!form.entry_price || !form.quantity || !form.entry_date) return setError('Entry price, quantity and date are required')
    setLoading(true)
    try {
      await onAdd({
        account: form.account,
        ticker: form.ticker.toUpperCase().trim(),
        direction: form.direction,
        entry_date: form.entry_date,
        entry_price: parseFloat(form.entry_price),
        quantity: parseFloat(form.quantity),
        invested_capital: totalBuyingValue || null,
        actual_investment: form.actual_investment ? parseFloat(form.actual_investment) : null,
        mtf_interest_rate: form.mtf_interest_rate ? parseFloat(form.mtf_interest_rate) : null,
        notes: [form.strategy, form.notes].filter(Boolean).join(' | ') || null,
        status: 'OPEN',
      })
      onClose()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const fieldStyle = { background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'6px', padding:'8px 12px', color:'var(--text)', fontSize:'12px', fontFamily:'DM Mono, monospace', width:'100%', outline:'none', boxSizing:'border-box' }
  const labelStyle = { fontSize:'9px', color:'var(--muted)', letterSpacing:'0.12em', textTransform:'uppercase', display:'block', marginBottom:'5px' }
  const sectionStyle = { fontSize:'9px', color:'var(--muted)', letterSpacing:'0.14em', textTransform:'uppercase', fontWeight:700, borderBottom:'1px solid var(--border)', paddingBottom:'6px', marginTop:'20px', marginBottom:'12px' }

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth:'580px', maxHeight:'90vh', overflowY:'auto' }}>

        {/* Header */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'20px' }}>
          <div>
            <div className="modal-title" style={{ marginBottom:'2px' }}>New Trade Entry</div>
            <div style={{ fontSize:'10px', color:'var(--muted)' }}>Fields marked * are required</div>
          </div>
          <button onClick={onClose} style={{ background:'none', border:'none', color:'var(--muted)', cursor:'pointer', fontSize:'20px', lineHeight:1 }}>×</button>
        </div>

        <form onSubmit={handleSubmit}>

          {/* ── TRADE INFO ── */}
          <div style={sectionStyle}>Trade Info</div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px' }}>

            {/* Account */}
            <div style={{ gridColumn:'1 / -1' }}>
              <label style={labelStyle}>Account *</label>
              <div style={{ display:'flex', gap:'8px' }}>
                <select value={form.account} onChange={e => set('account', e.target.value)} style={{ ...fieldStyle, flex:1 }}>
                  <option value="">— Select Account —</option>
                  {accounts.map(a => <option key={a.id} value={a.name}>{a.name}</option>)}
                </select>
                <button type="button" onClick={() => setShowAddAccount(v=>!v)} className="btn btn-ghost" style={{ padding:'7px 12px', fontSize:'11px', whiteSpace:'nowrap' }}>
                  {showAddAccount ? 'Cancel' : '+ Add'}
                </button>
              </div>
              {showAddAccount && (
                <div style={{ marginTop:'8px', padding:'12px', background:'var(--bg)', borderRadius:'4px', border:'1px solid var(--border)' }}>
                  <div style={{ display:'flex', gap:'8px', marginBottom:'10px' }}>
                    <input value={newAccount} onChange={e => setNewAccount(e.target.value)} placeholder="Account name (e.g. RAVI)" style={{ ...fieldStyle, flex:1, textTransform:'uppercase' }} onKeyDown={e => e.key==='Enter' && (e.preventDefault(), handleAddAccount())} />
                    <button type="button" onClick={handleAddAccount} disabled={accountLoading} className="btn btn-primary" style={{ padding:'7px 14px' }}>{accountLoading ? '...' : 'Add'}</button>
                  </div>
                  {accounts.length > 0 && (
                    <div style={{ display:'flex', flexWrap:'wrap', gap:'6px' }}>
                      {accounts.map(a => (
                        <span key={a.id} className="account-chip">{a.name}
                          <button type="button" onClick={() => handleDeleteAccount(a.id)} style={{ background:'none', border:'none', color:'var(--red)', cursor:'pointer', fontSize:'12px', padding:0 }}>×</button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Ticker */}
            <div style={{ position:'relative' }}>
              <label style={labelStyle}>Ticker * {searchLoading && <span style={{ fontWeight:400 }}>searching...</span>}</label>
              <input value={form.ticker} onChange={e => searchTicker(e.target.value.toUpperCase())} onBlur={() => setTimeout(()=>setShowSuggestions(false),200)} onFocus={() => suggestions.length>0 && setShowSuggestions(true)} placeholder="RELI, TCS..." style={{ ...fieldStyle, textTransform:'uppercase' }} autoComplete="off" />
              {showSuggestions && suggestions.length>0 && (
                <div style={{ position:'absolute', top:'100%', left:0, right:0, zIndex:999, background:'var(--bg)', border:'1px solid var(--accent)', borderRadius:'6px', boxShadow:'0 8px 24px rgba(0,0,0,0.15)', maxHeight:'200px', overflowY:'auto', marginTop:'2px' }}>
                  {suggestions.map((item,i) => (
                    <div key={i} onMouseDown={() => selectTicker(item)} style={{ padding:'8px 12px', cursor:'pointer', borderBottom:'1px solid var(--border)', display:'flex', justifyContent:'space-between', alignItems:'center' }} onMouseEnter={e=>e.currentTarget.style.background='var(--surface)'} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                      <div>
                        <div style={{ fontFamily:'DM Mono, monospace', fontWeight:700, fontSize:'13px', color:'var(--accent)' }}>{item.ticker}</div>
                        <div style={{ fontSize:'10px', color:'var(--muted)', marginTop:'1px' }}>{item.shortName}</div>
                      </div>
                      <div style={{ fontSize:'10px', fontFamily:'DM Mono, monospace', color:'var(--muted)', background:'var(--surface)', padding:'2px 6px', borderRadius:'3px' }}>{item.exchange}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Direction */}
            <div>
              <label style={labelStyle}>Direction *</label>
              <div style={{ display:'flex', gap:'6px' }}>
                {['LONG','SHORT'].map(d => (
                  <button key={d} type="button" onClick={() => set('direction', d)} style={{
                    flex:1, padding:'8px', borderRadius:'4px', cursor:'pointer', fontSize:'11px', fontFamily:'DM Mono, monospace', fontWeight:form.direction===d?700:400, letterSpacing:'0.06em', transition:'all 0.15s',
                    border:`1px solid ${form.direction===d?(d==='LONG'?'var(--bull)':'var(--bear)'):'var(--border)'}`,
                    background: form.direction===d?(d==='LONG'?'rgba(0,230,118,0.1)':'rgba(255,71,87,0.1)'):'var(--surface)',
                    color: form.direction===d?(d==='LONG'?'var(--bull)':'var(--bear)'):'var(--muted)',
                  }}>{d==='LONG'?'▲ LONG':'▼ SHORT'}</button>
                ))}
              </div>
            </div>
          </div>

          {/* ── ENTRY DETAILS ── */}
          <div style={sectionStyle}>Entry Details</div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'12px' }}>
            <div>
              <label style={labelStyle}>Entry Date *</label>
              <input type="date" value={form.entry_date} onChange={e => set('entry_date', e.target.value)} style={fieldStyle} />
            </div>
            <div>
              <label style={labelStyle}>Entry Price Rs *</label>
              <input type="number" value={form.entry_price} onChange={e => set('entry_price', e.target.value)} placeholder="0.00" style={fieldStyle} step="0.01" min="0" />
            </div>
            <div>
              <label style={labelStyle}>Quantity *</label>
              <input type="number" value={form.quantity} onChange={e => set('quantity', e.target.value)} placeholder="100" style={fieldStyle} min="1" />
            </div>
          </div>

          {/* Total Buying Value — auto calc */}
          {totalBuyingValue && (
            <div style={{ marginTop:'10px', padding:'10px 14px', background:'var(--bg)', borderRadius:'6px', border:'1px solid var(--border)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <span style={{ fontSize:'10px', color:'var(--muted)', letterSpacing:'0.12em', textTransform:'uppercase' }}>Total Buying Value</span>
              <span style={{ color:'var(--accent)', fontWeight:700, fontFamily:'DM Mono, monospace', fontSize:'14px' }}>Rs. {totalBuyingValue.toLocaleString('en-IN', { maximumFractionDigits:2 })}</span>
            </div>
          )}

          {/* ── YOUR INVESTMENT (MTF) ── */}
          <div style={sectionStyle}>Your Investment <span style={{ color:'var(--border)', fontWeight:400 }}>(optional — for MTF trades)</span></div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px' }}>
            <div>
              <label style={labelStyle}>Required Margin Paid by You Rs</label>
              <input type="number" value={form.actual_investment} onChange={e => set('actual_investment', e.target.value)} placeholder="Your margin amount" style={fieldStyle} step="0.01" min="0" />
            </div>
            <div>
              <label style={labelStyle}>MTF Rate % p.a.</label>
              <input type="number" value={form.mtf_interest_rate} onChange={e => set('mtf_interest_rate', e.target.value)} placeholder="e.g. 18" style={fieldStyle} step="0.01" min="0" max="100" />
            </div>
          </div>

          {/* MTF summary */}
          {mtfBorrowed !== null && mtfBorrowed > 0 && (
            <div style={{ marginTop:'8px', padding:'10px 14px', background:'rgba(245,158,11,0.06)', borderRadius:'6px', border:'1px solid rgba(245,158,11,0.2)', display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:'8px' }}>
              <div>
                <div style={{ fontSize:'9px', color:'var(--muted)', letterSpacing:'0.1em', textTransform:'uppercase', marginBottom:'2px' }}>MTF Borrowed Amount</div>
                <div style={{ color:'var(--gold)', fontWeight:700, fontFamily:'DM Mono, monospace' }}>Rs. {mtfBorrowed.toLocaleString('en-IN', { maximumFractionDigits:2 })}</div>
              </div>
              {dailyInterest && (
                <div style={{ textAlign:'right' }}>
                  <div style={{ fontSize:'9px', color:'var(--muted)', letterSpacing:'0.1em', textTransform:'uppercase', marginBottom:'2px' }}>Daily Interest</div>
                  <div style={{ color:'var(--gold)', fontWeight:700, fontFamily:'DM Mono, monospace' }}>Rs. {dailyInterest.toFixed(2)}/day</div>
                </div>
              )}
            </div>
          )}

          {/* ── NOTES / STRATEGY ── */}
          <div style={sectionStyle}>
            <span>Notes / Strategy</span>
            {isAdmin && (
              <button type="button" onClick={() => setShowManageStrategies(v=>!v)} style={{ float:'right', background:'none', border:'none', color:'var(--accent)', cursor:'pointer', fontSize:'10px', fontFamily:'DM Mono, monospace', letterSpacing:'0.08em' }}>
                {showManageStrategies ? '▲ Done' : '⚙ Manage'}
              </button>
            )}
          </div>

          {/* Admin: manage strategies panel */}
          {isAdmin && showManageStrategies && (
            <div style={{ marginBottom:'12px', padding:'12px', background:'var(--bg)', borderRadius:'6px', border:'1px solid var(--border)' }}>
              <div style={{ fontSize:'10px', color:'var(--muted)', marginBottom:'8px' }}>Add or remove strategies from the dropdown</div>
              <div style={{ display:'flex', gap:'8px', marginBottom:'10px' }}>
                <input value={newStrategy} onChange={e => setNewStrategy(e.target.value.toUpperCase())} placeholder="NEW STRATEGY NAME" style={{ ...fieldStyle, flex:1 }} onKeyDown={e => e.key==='Enter' && (e.preventDefault(), handleAddStrategy())} />
                <button type="button" onClick={handleAddStrategy} disabled={strategyLoading} className="btn btn-primary" style={{ padding:'7px 14px', fontSize:'11px' }}>{strategyLoading ? '...' : 'Add'}</button>
              </div>
              <div style={{ display:'flex', flexWrap:'wrap', gap:'6px' }}>
                {strategies.map(s => (
                  <span key={s} style={{ display:'flex', alignItems:'center', gap:'4px', background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'4px', padding:'3px 8px', fontSize:'10px', fontFamily:'DM Mono, monospace', color:'var(--text)' }}>
                    {s}
                    <button type="button" onClick={() => handleDeleteStrategy(s)} style={{ background:'none', border:'none', color:'var(--bear)', cursor:'pointer', fontSize:'12px', padding:0, lineHeight:1 }}>×</button>
                  </span>
                ))}
              </div>
            </div>
          )}

          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px' }}>
            <div>
              <label style={labelStyle}>Strategy</label>
              <select value={form.strategy} onChange={e => set('strategy', e.target.value)} style={fieldStyle}>
                <option value="">— Select Strategy —</option>
                {strategies.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Notes</label>
              <input value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Setup, catalyst, plan..." style={fieldStyle} />
            </div>
          </div>

          {error && <p style={{ color:'var(--bear)', fontSize:'11px', marginTop:'10px' }}>{error}</p>}

          <div style={{ display:'flex', gap:'8px', justifyContent:'flex-end', marginTop:'20px' }}>
            <button type="button" onClick={onClose} className="btn btn-ghost">Cancel</button>
            <button type="submit" disabled={loading} className="btn btn-primary">{loading ? 'Adding...' : '+ Add Trade'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}
