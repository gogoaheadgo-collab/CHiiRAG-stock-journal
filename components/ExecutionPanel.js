import { useState } from 'react'

export default function ExecutionPanel({ trade, executions, onAdd, onDelete, onAutoClose }) {
  const [showForm, setShowForm] = useState(false)
  const [qty, setQty] = useState('')
  const [price, setPrice] = useState('')
  const [date, setDate] = useState(new Date().toISOString().slice(0,10))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const totalQty = Number(trade.quantity) || 0
  const entryPrice = Number(trade.entry_price) || 0
  const mtfRate = Number(trade.mtf_interest_rate) || 0
  const investment = Number(trade.invested_capital) || 0
  const actualInv = Number(trade.actual_investment) || 0
  const mtfBase = investment - actualInv

  const soldQty = executions.reduce((s,e) => s + Number(e.quantity), 0)
  const remainingQty = Math.max(0, totalQty - soldQty)

  const calcSellMTF = (exec) => {
    if (!mtfRate || mtfBase <= 0 || !trade.entry_date) return 0
    const days = Math.max(1, Math.floor((new Date(exec.date) - new Date(trade.entry_date)) / 86400000))
    return mtfBase * (Number(exec.quantity) / totalQty) * mtfRate * days / 36500
  }

  const remainingMTF = mtfBase > 0 && mtfRate && trade.entry_date && remainingQty > 0
    ? mtfBase * (remainingQty / totalQty) * mtfRate * Math.max(1, Math.floor((new Date() - new Date(trade.entry_date)) / 86400000)) / 36500
    : 0

  const totalSoldMTF = executions.reduce((s,e) => s + calcSellMTF(e), 0)
  const totalMTF = totalSoldMTF + remainingMTF
  const totalRealised = executions.reduce((s,e) => s + (Number(e.price) - entryPrice) * Number(e.quantity), 0)

  const fld = { background:'var(--bg)', border:'1px solid var(--border)', borderRadius:'4px', padding:'7px 10px', color:'var(--text)', fontSize:'13px', fontFamily:'DM Mono, monospace', outline:'none', width:'110px' }
  const lbl = { fontSize:'10px', color:'var(--muted)', fontWeight:600, letterSpacing:'0.08em', textTransform:'uppercase', display:'block', marginBottom:'4px' }
  const fmt = (n) => Number(n).toLocaleString('en-IN', { maximumFractionDigits:0 })
  const fmtd = (n) => Number(n).toLocaleString('en-IN', { maximumFractionDigits:2 })
  const pnlColor = (n) => n >= 0 ? 'var(--bull)' : 'var(--bear)'
  const pnlSign = (n) => n >= 0 ? '+' : '−'

  const handleSell = async (e) => {
    e.preventDefault()
    e.stopPropagation()
    setError('')
    const qtyNum = parseFloat(qty)
    const priceNum = parseFloat(price)
    if (!qtyNum || !priceNum || !date) { setError('All fields required'); return }
    if (qtyNum > remainingQty) { setError(`Max qty is ${remainingQty}`); return }
    setSaving(true)
    try {
      await onAdd({ type:'SELL', quantity:qtyNum, price:priceNum, date })
      const newSoldQty = soldQty + qtyNum
      if (newSoldQty >= totalQty && onAutoClose) {
        const newTotalRealised = totalRealised + (priceNum - entryPrice) * qtyNum
        await onAutoClose({ exit_price:priceNum, exit_date:date, realized_gains:newTotalRealised, status:'CLOSED' })
      }
      setQty(''); setPrice(''); setDate(new Date().toISOString().slice(0,10))
      setShowForm(false)
    } catch(err) {
      setError(err.message || 'Failed to save')
    }
    setSaving(false)
  }

  const qtyNum = parseFloat(qty) || 0
  const priceNum = parseFloat(price) || 0
  const realisedPreview = qtyNum && priceNum ? (priceNum - entryPrice) * qtyNum : null
  const sellMTFPreview = qtyNum && priceNum && date && mtfBase > 0 && trade.entry_date
    ? mtfBase * (qtyNum/totalQty) * mtfRate * Math.max(1, Math.floor((new Date(date) - new Date(trade.entry_date)) / 86400000)) / 36500
    : null

  return (
    <div style={{ padding:'16px 24px', borderTop:'2px solid var(--accent)' }} onClick={e=>e.stopPropagation()}>

      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'14px', flexWrap:'wrap', gap:'8px' }}>
        <div style={{ display:'flex', alignItems:'center', gap:'10px', flexWrap:'wrap' }}>
          <span style={{ fontSize:'11px', fontWeight:700, color:'var(--accent)', letterSpacing:'0.12em', textTransform:'uppercase' }}>Sell Executions — {trade.ticker}</span>
          <span style={{ fontSize:'10px', fontFamily:'DM Mono, monospace', color:'var(--muted)' }}>Entry Rs{entryPrice.toLocaleString('en-IN')} · Qty {fmt(totalQty)} · Remaining <strong style={{ color:remainingQty===0?'var(--bear)':'var(--bull)' }}>{fmt(remainingQty)}</strong></span>
          {mtfRate > 0 && <span style={{ fontSize:'10px', color:'var(--gold)', background:'rgba(245,158,11,0.1)', padding:'2px 8px', borderRadius:'4px', fontFamily:'DM Mono, monospace' }}>MTF {mtfRate}% p.a.</span>}
        </div>
        {remainingQty > 0 && (
          <button onClick={e=>{e.stopPropagation();setShowForm(v=>!v)}} style={{ padding:'5px 16px', background:showForm?'var(--surface)':'var(--bear)', border:'1px solid var(--border)', borderRadius:'5px', color:showForm?'var(--muted)':'#fff', fontSize:'11px', fontFamily:'DM Mono, monospace', cursor:'pointer', fontWeight:600 }}>
            {showForm ? 'Cancel' : '+ Add Sell'}
          </button>
        )}
      </div>

      {/* Sell Form */}
      {showForm && (
        <div style={{ padding:'14px', background:'var(--surface)', borderRadius:'8px', border:'1px solid var(--border)', marginBottom:'14px' }} onClick={e=>e.stopPropagation()}>
          <div style={{ display:'flex', gap:'12px', flexWrap:'wrap', alignItems:'flex-end' }}>
            <div><label style={lbl}>Sell Qty * (max {fmt(remainingQty)})</label><input type="number" placeholder={String(remainingQty)} value={qty} onChange={e=>setQty(e.target.value)} style={fld} autoFocus /></div>
            <div><label style={lbl}>Sell Price Rs *</label><input type="number" placeholder="0.00" value={price} onChange={e=>setPrice(e.target.value)} style={fld} /></div>
            <div><label style={lbl}>Sell Date *</label><input type="date" value={date} onChange={e=>setDate(e.target.value)} style={{ ...fld, width:'150px' }} /></div>
            <button onClick={handleSell} disabled={saving} style={{ padding:'7px 24px', background:'var(--bear)', border:'none', borderRadius:'5px', color:'#fff', fontSize:'13px', fontWeight:700, cursor:saving?'not-allowed':'pointer', fontFamily:'DM Mono, monospace', opacity:saving?0.7:1 }}>
              {saving ? 'Saving...' : 'Sell'}
            </button>
          </div>
          {/* Preview */}
          {realisedPreview !== null && (
            <div style={{ marginTop:'10px', display:'flex', gap:'20px', fontSize:'11px', fontFamily:'DM Mono, monospace', flexWrap:'wrap' }}>
              <span>Realised P&L: <strong style={{ color:pnlColor(realisedPreview) }}>{pnlSign(realisedPreview)}Rs{fmtd(Math.abs(realisedPreview))}</strong></span>
              {sellMTFPreview > 0 && <span>MTF this sell: <strong style={{ color:'var(--gold)' }}>Rs{fmtd(sellMTFPreview)}</strong></span>}
              {qtyNum >= remainingQty && <span style={{ color:'var(--bear)', fontWeight:700 }}>⚠ Full Exit — trade closes</span>}
            </div>
          )}
          {error && <div style={{ color:'var(--bear)', fontSize:'12px', marginTop:'8px', fontFamily:'DM Mono, monospace' }}>⚠ {error}</div>}
        </div>
      )}

      {/* Executions Table */}
      {executions.length === 0 ? (
        <div style={{ fontSize:'11px', color:'var(--muted)', padding:'8px 0' }}>No sell executions yet. Click "+ Add Sell" to record a sale.</div>
      ) : (
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'12px' }}>
          <thead>
            <tr style={{ borderBottom:'1px solid var(--border)' }}>
              {['#','Sell Date','Qty','Sell Rs','Value Rs','Realised P&L','MTF Interest Rs',''].map((h,i) => (
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
                  <td style={{ padding:'8px 10px', textAlign:'right', color:'var(--muted)', whiteSpace:'nowrap', fontFamily:'DM Mono, monospace' }}>{exec.date}</td>
                  <td style={{ padding:'8px 10px', textAlign:'right', fontFamily:'DM Mono, monospace', fontWeight:600 }}>{fmt(exec.quantity)}</td>
                  <td style={{ padding:'8px 10px', textAlign:'right', fontFamily:'DM Mono, monospace' }}>Rs{Number(exec.price).toLocaleString('en-IN')}</td>
                  <td style={{ padding:'8px 10px', textAlign:'right', fontFamily:'DM Mono, monospace' }}>Rs{fmt(val)}</td>
                  <td style={{ padding:'8px 10px', textAlign:'right', fontFamily:'DM Mono, monospace', fontWeight:600, color:pnlColor(realised) }}>{pnlSign(realised)}Rs{fmtd(Math.abs(realised))}</td>
                  <td style={{ padding:'8px 10px', textAlign:'right', fontFamily:'DM Mono, monospace', color:'var(--gold)' }}>{mtfInterest>0?`Rs${fmtd(mtfInterest)}`:<span style={{ color:'var(--muted)' }}>—</span>}</td>
                  <td style={{ padding:'8px 10px', textAlign:'center' }}>
                    <button onClick={e=>{e.stopPropagation(); if(!window.confirm('🗑 Delete this execution?\n\nThis will affect Realised P&L calculations.')) return; if(!window.confirm('⚠️ CONFIRM DELETE\n\nAre you sure? This cannot be undone.')) return; onDelete(exec.id)}} style={{ background:'none', border:'none', color:'var(--bear)', cursor:'pointer', fontSize:'16px', lineHeight:1, padding:'0 4px' }}>×</button>
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
                  <span><span style={{ color:'var(--muted)' }}>Realised P&L: </span><span style={{ color:pnlColor(totalRealised), fontWeight:700 }}>{pnlSign(totalRealised)}Rs{fmtd(Math.abs(totalRealised))}</span></span>
                  {totalMTF > 0 && <span><span style={{ color:'var(--muted)' }}>Total MTF Interest: </span><span style={{ color:'var(--gold)', fontWeight:700 }}>Rs{fmtd(totalMTF)}</span></span>}
                  {remainingMTF > 0 && <span><span style={{ color:'var(--muted)' }}>Remaining MTF (till today): </span><span style={{ color:'var(--gold)', fontWeight:700 }}>Rs{fmtd(remainingMTF)}</span></span>}
                </div>
              </td>
            </tr>
          </tfoot>
        </table>
      )}
    </div>
  )
}
