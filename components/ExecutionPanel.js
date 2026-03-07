import { useState } from 'react'

export default function ExecutionPanel({ trade, executions, onAdd, onDelete, onAutoClose }) {
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ quantity:'', price:'', date:new Date().toISOString().slice(0,10) })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const set = (k,v) => setForm(f=>({...f,[k]:v}))

  const totalQty = parseFloat(trade.quantity) || 0
  const entryPrice = parseFloat(trade.entry_price) || 0
  const mtfRate = parseFloat(trade.mtf_interest_rate) || 0
  const investment = parseFloat(trade.invested_capital) || 0
  const actualInv = parseFloat(trade.actual_investment) || 0
  const mtfBase = investment - actualInv // total MTF-funded amount

  const soldQty = executions.reduce((s,e) => s + Number(e.quantity), 0)
  const remainingQty = totalQty - soldQty

  // MTF for sold portion of a sell execution
  const calcSellMTF = (exec) => {
    if (!mtfRate || mtfBase <= 0 || !trade.entry_date) return null
    const portion = Number(exec.quantity) / totalQty
    const days = Math.max(1, Math.floor((new Date(exec.date) - new Date(trade.entry_date)) / 86400000))
    return mtfBase * portion * mtfRate * days / 36500
  }

  // MTF for remaining (unsold) qty — accruing until today
  const remainingMTF = () => {
    if (!mtfRate || mtfBase <= 0 || !trade.entry_date || remainingQty <= 0) return 0
    const portion = remainingQty / totalQty
    const days = Math.max(1, Math.floor((new Date() - new Date(trade.entry_date)) / 86400000))
    return mtfBase * portion * mtfRate * days / 36500
  }

  const totalSoldMTF = executions.reduce((s,e) => s + (calcSellMTF(e)||0), 0)
  const totalMTF = totalSoldMTF + remainingMTF()
  const totalRealised = executions.reduce((s,e) => s + (Number(e.price) - entryPrice) * Number(e.quantity), 0)

  const submit = async () => {
    setError('')
    const qty = parseFloat(form.quantity)
    const price = parseFloat(form.price)
    if (!qty || !price || !form.date) return setError('All fields required')
    if (qty > remainingQty) return setError(`Max sellable qty is ${remainingQty}`)
    setSaving(true)
    try {
      await onAdd({ type:'SELL', quantity:qty, price, date:form.date })
      // Auto-close if all qty sold
      const newSold = soldQty + qty
      if (newSold >= totalQty && onAutoClose) {
        const lastRealised = (price - entryPrice) * qty
        const totalRealisedAll = totalRealised + lastRealised
        await onAutoClose({ exit_price:price, exit_date:form.date, realized_gains:totalRealisedAll, status:'CLOSED' })
      }
      setForm({ quantity:'', price:'', date:new Date().toISOString().slice(0,10) })
      setShowForm(false)
    } catch(err) { setError(err.message) }
    setSaving(false)
  }

  const fld = { background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'4px', padding:'6px 10px', color:'var(--text)', fontSize:'12px', fontFamily:'DM Mono, monospace', outline:'none' }
  const lbl = { fontSize:'10px', color:'var(--muted)', fontWeight:600, letterSpacing:'0.08em', textTransform:'uppercase', display:'block', marginBottom:'3px' }
  const fmt = (n) => Number(n).toLocaleString('en-IN', { maximumFractionDigits:0 })
  const fmtd = (n) => Number(n).toLocaleString('en-IN', { maximumFractionDigits:2 })
  const pnlColor = (n) => n >= 0 ? 'var(--bull)' : 'var(--bear)'
  const pnlSign = (n) => n >= 0 ? '+' : '−'

  return (
    <div style={{ padding:'16px 24px', borderTop:'2px solid var(--accent)' }} onClick={e=>e.stopPropagation()}>

      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'14px' }}>
        <div style={{ display:'flex', alignItems:'center', gap:'10px', flexWrap:'wrap' }}>
          <div style={{ fontSize:'11px', fontWeight:700, color:'var(--accent)', letterSpacing:'0.12em', textTransform:'uppercase' }}>
            Sell Executions — {trade.ticker}
          </div>
          <div style={{ fontSize:'10px', fontFamily:'DM Mono, monospace', color:'var(--muted)' }}>
            Entry: ₹{entryPrice.toLocaleString('en-IN')} · Total Qty: {fmt(totalQty)} · Remaining: <span style={{ color:remainingQty>0?'var(--bull)':'var(--bear)', fontWeight:700 }}>{fmt(remainingQty)}</span>
          </div>
          {mtfRate > 0 && <div style={{ fontSize:'10px', color:'var(--gold)', background:'rgba(245,158,11,0.1)', padding:'2px 8px', borderRadius:'4px', fontFamily:'DM Mono, monospace' }}>MTF: {mtfRate}% p.a.</div>}
        </div>
        {remainingQty > 0 && (
          <button onClick={()=>setShowForm(v=>!v)} style={{ padding:'5px 14px', background:showForm?'var(--surface)':'var(--bear)', border:'1px solid var(--border)', borderRadius:'5px', color:showForm?'var(--muted)':'#fff', fontSize:'11px', fontFamily:'DM Mono, monospace', cursor:'pointer', fontWeight:600 }}>
            {showForm ? 'Cancel' : '+ Add Sell'}
          </button>
        )}
      </div>

      {/* Add Sell form */}
      {showForm && (
        <div style={{ padding:'14px', background:'var(--surface)', borderRadius:'8px', border:'1px solid var(--border)', marginBottom:'14px' }}>
          <div style={{ display:'flex', gap:'10px', flexWrap:'wrap', alignItems:'flex-end' }}>
            <div>
              <label style={lbl}>Sell Qty * (max: {fmt(remainingQty)})</label>
              <input type="number" placeholder={String(remainingQty)} value={form.quantity} onChange={e=>set('quantity',e.target.value)} style={{ ...fld, width:'100px' }} autoFocus />
            </div>
            <div>
              <label style={lbl}>Sell Price ₹ *</label>
              <input type="number" placeholder="0.00" value={form.price} onChange={e=>set('price',e.target.value)} style={{ ...fld, width:'110px' }} />
            </div>
            <div>
              <label style={lbl}>Sell Date *</label>
              <input type="date" value={form.date} onChange={e=>set('date',e.target.value)} style={{ ...fld, width:'140px' }} />
            </div>
            <button onClick={submit} disabled={saving} style={{ padding:'6px 20px', background:'var(--bear)', border:'none', borderRadius:'4px', color:'#fff', fontSize:'12px', fontWeight:700, cursor:'pointer', fontFamily:'DM Mono, monospace' }}>
              {saving ? '...' : 'Sell'}
            </button>
          </div>
          {/* P&L Preview */}
          {form.quantity && form.price && (
            <div style={{ marginTop:'10px', display:'flex', gap:'20px', fontSize:'11px', fontFamily:'DM Mono, monospace', flexWrap:'wrap' }}>
              {(() => {
                const q = parseFloat(form.quantity)||0
                const p = parseFloat(form.price)||0
                const realisedPreview = (p - entryPrice) * q
                const sellMTFPreview = mtfBase>0 && form.date && trade.entry_date
                  ? mtfBase*(q/totalQty)*mtfRate*Math.max(1,Math.floor((new Date(form.date)-new Date(trade.entry_date))/86400000))/36500
                  : 0
                return (
                  <>
                    <span>Realised P&L: <strong style={{ color:pnlColor(realisedPreview) }}>{pnlSign(realisedPreview)}₹{fmtd(Math.abs(realisedPreview))}</strong></span>
                    {sellMTFPreview > 0 && <span>MTF Interest (this sell): <strong style={{ color:'var(--gold)' }}>₹{fmtd(sellMTFPreview)}</strong></span>}
                    {q >= remainingQty && <span style={{ color:'var(--bear)', fontWeight:700 }}>⚠ Full Exit — trade will close</span>}
                  </>
                )
              })()}
            </div>
          )}
          {error && <div style={{ color:'var(--bear)', fontSize:'12px', marginTop:'8px' }}>{error}</div>}
        </div>
      )}

      {/* Sell Table */}
      {executions.length === 0 ? (
        <div style={{ fontSize:'11px', color:'var(--muted)', padding:'8px 0' }}>No sell executions yet. Click "+ Add Sell" to record a sale.</div>
      ) : (
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'12px' }}>
          <thead>
            <tr style={{ borderBottom:'1px solid var(--border)' }}>
              {['#','Sell Date','Sell Qty','Sell Price ₹','Value ₹','Realised P&L','MTF Interest ₹',''].map((h,i) => (
                <th key={i} style={{ padding:'6px 10px', textAlign:h===''||h==='#'?'center':'right', fontSize:'9px', color:'var(--muted)', fontFamily:'DM Mono, monospace', fontWeight:600, letterSpacing:'0.08em', textTransform:'uppercase', whiteSpace:'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {executions.map((exec,i) => {
              const val = Number(exec.quantity) * Number(exec.price)
              const realised = (Number(exec.price) - entryPrice) * Number(exec.quantity)
              const mtfInterest = calcSellMTF(exec)
              return (
                <tr key={exec.id} style={{ borderBottom:'1px solid var(--border)', background:i%2===0?'transparent':'rgba(0,0,0,0.015)' }}>
                  <td style={{ padding:'8px 10px', textAlign:'center', color:'var(--muted)', fontSize:'11px' }}>{i+1}</td>
                  <td style={{ padding:'8px 10px', textAlign:'right', color:'var(--muted)', whiteSpace:'nowrap' }}>{exec.date}</td>
                  <td style={{ padding:'8px 10px', textAlign:'right', fontFamily:'DM Mono, monospace', fontWeight:600 }}>{fmt(exec.quantity)}</td>
                  <td style={{ padding:'8px 10px', textAlign:'right', fontFamily:'DM Mono, monospace' }}>₹{Number(exec.price).toLocaleString('en-IN')}</td>
                  <td style={{ padding:'8px 10px', textAlign:'right', fontFamily:'DM Mono, monospace' }}>₹{fmt(val)}</td>
                  <td style={{ padding:'8px 10px', textAlign:'right', fontFamily:'DM Mono, monospace', fontWeight:600, color:pnlColor(realised) }}>{pnlSign(realised)}₹{fmtd(Math.abs(realised))}</td>
                  <td style={{ padding:'8px 10px', textAlign:'right', fontFamily:'DM Mono, monospace', color:'var(--gold)' }}>{mtfInterest?`₹${fmtd(mtfInterest)}`:<span style={{ color:'var(--muted)' }}>—</span>}</td>
                  <td style={{ padding:'8px 10px', textAlign:'center' }}>
                    <button onClick={()=>onDelete(exec.id)} style={{ background:'none', border:'none', color:'var(--bear)', cursor:'pointer', fontSize:'14px', lineHeight:1, padding:'0 4px' }}>×</button>
                  </td>
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr style={{ borderTop:'2px solid var(--border)', background:'var(--surface)' }}>
              <td colSpan={8} style={{ padding:'10px 12px' }}>
                <div style={{ display:'flex', gap:'24px', fontSize:'11px', fontFamily:'DM Mono, monospace', flexWrap:'wrap' }}>
                  <span><span style={{ color:'var(--muted)' }}>Total Sold: </span><span style={{ fontWeight:700 }}>{fmt(soldQty)} shares</span></span>
                  <span><span style={{ color:'var(--muted)' }}>Realised P&L: </span><span style={{ color:pnlColor(totalRealised), fontWeight:700 }}>{pnlSign(totalRealised)}₹{fmtd(Math.abs(totalRealised))}</span></span>
                  {totalMTF > 0 && <span><span style={{ color:'var(--muted)' }}>Total MTF Interest: </span><span style={{ color:'var(--gold)', fontWeight:700 }}>₹{fmtd(totalMTF)}</span></span>}
                  {remainingQty > 0 && <span><span style={{ color:'var(--muted)' }}>Remaining MTF (till today): </span><span style={{ color:'var(--gold)', fontWeight:700 }}>₹{fmtd(remainingMTF())}</span></span>}
                </div>
              </td>
            </tr>
          </tfoot>
        </table>
      )}
    </div>
  )
}
