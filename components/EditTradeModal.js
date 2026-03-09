import { useState, useEffect } from 'react'

const DEFAULT_STRATEGIES = ['VCP CONTRACTION', 'IPO', 'TIPS', 'OTHER']

export default function EditTradeModal({ trade, onClose, onSave, session, isAdmin }) {
  // Parse existing notes — extract strategy if it was saved as "STRATEGY | notes"
  const existingNotes = trade.notes || ''
  const pipeParts = existingNotes.split(' | ')

  const [form, setForm] = useState({
    ticker: trade.ticker || '',
    direction: trade.direction || 'LONG',
    entry_date: trade.entry_date?.slice(0, 10) || '',
    entry_price: trade.entry_price || '',
    quantity: trade.quantity || '',
    actual_investment: trade.actual_investment || '',
    mtf_interest_rate: trade.mtf_interest_rate || '',
    strategy: pipeParts.length > 1 ? pipeParts[0] : '',
    notes: pipeParts.length > 1 ? pipeParts.slice(1).join(' | ') : existingNotes,
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [strategies, setStrategies] = useState(DEFAULT_STRATEGIES)
  const [showManageStrategies, setShowManageStrategies] = useState(false)
  const [newStrategy, setNewStrategy] = useState('')
  const [strategyLoading, setStrategyLoading] = useState(false)

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const getToken = () => session?.access_token

  const totalBuyingValue = form.entry_price && form.quantity
    ? parseFloat(form.entry_price) * parseFloat(form.quantity)
    : null

  const mtfBorrowed = totalBuyingValue && form.actual_investment
    ? totalBuyingValue - parseFloat(form.actual_investment)
    : null

  const dailyInterest = mtfBorrowed && mtfBorrowed > 0 && form.mtf_interest_rate
    ? (mtfBorrowed * parseFloat(form.mtf_interest_rate)) / 36500
    : null

  useEffect(() => {
    if (!getToken()) return
    fetch('/api/strategies', { headers: { Authorization: `Bearer ${getToken()}` } })
      .then(r => r.json()).then(d => { if (Array.isArray(d)) setStrategies(d) }).catch(() => {})
  }, [])

  const handleAddStrategy = async () => {
    if (!newStrategy.trim()) return
    setStrategyLoading(true)
    const res = await fetch('/api/strategies', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
      body: JSON.stringify({ name: newStrategy }),
    })
    if (res.ok) {
      const r = await fetch('/api/strategies', { headers: { Authorization: `Bearer ${getToken()}` } })
      const d = await r.json()
      if (Array.isArray(d)) setStrategies(d)
      setNewStrategy('')
    }
    setStrategyLoading(false)
  }

  const handleDeleteStrategy = async (name) => {
    await fetch('/api/strategies', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
      body: JSON.stringify({ name }),
    })
    const r = await fetch('/api/strategies', { headers: { Authorization: `Bearer ${getToken()}` } })
    const d = await r.json()
    if (Array.isArray(d)) setStrategies(d)
  }

  const handleSave = async () => {
    setError('')
    if (!form.ticker.trim()) return setError('Ticker is required')
    if (!form.entry_price || !form.quantity || !form.entry_date) return setError('Entry price, quantity and date are required')
    setLoading(true)
    try {
      await onSave({
        ticker: form.ticker.toUpperCase().trim(),
        direction: form.direction,
        entry_date: form.entry_date,
        entry_price: parseFloat(form.entry_price),
        quantity: parseFloat(form.quantity),
        invested_capital: totalBuyingValue || null,
        actual_investment: form.actual_investment ? parseFloat(form.actual_investment) : null,
        mtf_interest_rate: form.mtf_interest_rate ? parseFloat(form.mtf_interest_rate) : null,
        notes: [form.strategy, form.notes].filter(Boolean).join(' | ') || null,
      })
      onClose()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const fieldStyle = { width:'100%', background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'6px', padding:'8px 12px', color:'var(--text)', fontSize:'12px', fontFamily:'DM Mono, monospace', outline:'none', boxSizing:'border-box' }
  const labelStyle = { fontSize:'9px', color:'var(--muted)', letterSpacing:'0.12em', textTransform:'uppercase', display:'block', marginBottom:'5px' }
  const sectionStyle = { fontSize:'9px', color:'var(--muted)', letterSpacing:'0.14em', textTransform:'uppercase', fontWeight:700, borderBottom:'1px solid var(--border)', paddingBottom:'6px', marginTop:'20px', marginBottom:'12px' }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.4)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000, padding:'16px' }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background:'var(--bg)', border:'1px solid var(--border)', borderRadius:'12px', padding:'28px', width:'100%', maxWidth:'560px', maxHeight:'90vh', overflowY:'auto', boxShadow:'0 20px 60px rgba(0,0,0,0.15)' }}>

        {/* Header */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'20px' }}>
          <div>
            <div style={{ fontFamily:'Bookman Old Style, serif', fontWeight:700, fontSize:'18px', color:'var(--text)' }}>Edit Trade</div>
            <div style={{ fontSize:'11px', color:'var(--muted)', marginTop:'2px' }}>{trade.ticker} · {trade.account}</div>
          </div>
          <button onClick={onClose} style={{ background:'none', border:'none', fontSize:'20px', color:'var(--muted)', cursor:'pointer' }}>×</button>
        </div>

        {/* TRADE INFO */}
        <div style={sectionStyle}>Trade Info</div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px' }}>
          <div style={{ gridColumn:'1 / -1' }}>
            <label style={labelStyle}>Ticker *</label>
            <input value={form.ticker} onChange={e => set('ticker', e.target.value.toUpperCase())} placeholder="RELIANCE, TCS..." style={{ ...fieldStyle, textTransform:'uppercase' }} />
          </div>
          <div style={{ gridColumn:'1 / -1' }}>
            <label style={labelStyle}>Direction *</label>
            <div style={{ display:'flex', gap:'8px' }}>
              {['LONG','SHORT'].map(d => (
                <button key={d} onClick={() => set('direction', d)} style={{
                  flex:1, padding:'8px', borderRadius:'6px', cursor:'pointer', fontSize:'11px', fontFamily:'DM Mono, monospace', fontWeight:form.direction===d?700:400,
                  border:`1px solid ${form.direction===d?(d==='LONG'?'var(--bull)':'var(--bear)'):'var(--border)'}`,
                  background: form.direction===d?(d==='LONG'?'rgba(0,230,118,0.1)':'rgba(255,71,87,0.1)'):'var(--surface)',
                  color: form.direction===d?(d==='LONG'?'var(--bull)':'var(--bear)'):'var(--muted)',
                }}>{d==='LONG'?'▲ LONG':'▼ SHORT'}</button>
              ))}
            </div>
          </div>
        </div>

        {/* ENTRY DETAILS */}
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

        {/* Total Buying Value */}
        {totalBuyingValue && (
          <div style={{ marginTop:'10px', padding:'10px 14px', background:'var(--bg)', borderRadius:'6px', border:'1px solid var(--border)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <span style={{ fontSize:'10px', color:'var(--muted)', letterSpacing:'0.12em', textTransform:'uppercase' }}>Total Buying Value</span>
            <span style={{ color:'var(--accent)', fontWeight:700, fontFamily:'DM Mono, monospace', fontSize:'14px' }}>Rs. {totalBuyingValue.toLocaleString('en-IN', { minimumFractionDigits:2, maximumFractionDigits:2 })}</span>
          </div>
        )}

        {/* YOUR INVESTMENT */}
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

        {mtfBorrowed !== null && mtfBorrowed > 0 && (
          <div style={{ marginTop:'8px', padding:'10px 14px', background:'rgba(245,158,11,0.06)', borderRadius:'6px', border:'1px solid rgba(245,158,11,0.2)', display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:'8px' }}>
            <div>
              <div style={{ fontSize:'9px', color:'var(--muted)', letterSpacing:'0.1em', textTransform:'uppercase', marginBottom:'2px' }}>MTF Borrowed Amount</div>
              <div style={{ color:'var(--gold)', fontWeight:700, fontFamily:'DM Mono, monospace' }}>Rs. {mtfBorrowed.toLocaleString('en-IN', { minimumFractionDigits:2, maximumFractionDigits:2 })}</div>
            </div>
            {dailyInterest && (
              <div style={{ textAlign:'right' }}>
                <div style={{ fontSize:'9px', color:'var(--muted)', letterSpacing:'0.1em', textTransform:'uppercase', marginBottom:'2px' }}>Daily Interest</div>
                <div style={{ color:'var(--gold)', fontWeight:700, fontFamily:'DM Mono, monospace' }}>Rs. {dailyInterest.toFixed(2)}/day</div>
              </div>
            )}
          </div>
        )}

        {/* NOTES / STRATEGY */}
        <div style={sectionStyle}>
          <span>Notes / Strategy</span>
          {isAdmin && (
            <button type="button" onClick={() => setShowManageStrategies(v=>!v)} style={{ float:'right', background:'none', border:'none', color:'var(--accent)', cursor:'pointer', fontSize:'10px', fontFamily:'DM Mono, monospace' }}>
              {showManageStrategies ? '▲ Done' : '⚙ Manage'}
            </button>
          )}
        </div>

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

        {error && <div style={{ color:'var(--bear)', fontSize:'12px', marginTop:'10px' }}>{error}</div>}

        <div style={{ display:'flex', gap:'10px', marginTop:'20px' }}>
          <button onClick={onClose} style={{ flex:1, padding:'10px', background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'6px', color:'var(--muted)', cursor:'pointer', fontSize:'13px' }}>Cancel</button>
          <button onClick={handleSave} disabled={loading} style={{ flex:2, padding:'10px', borderRadius:'6px', border:'none', background:'var(--accent)', color:'#fff', fontWeight:700, fontSize:'13px', cursor:'pointer' }}>
            {loading ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  )
}
