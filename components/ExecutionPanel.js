import { useState } from 'react'

function ExecutionPanel({ trade, executions, onAdd, onDelete }) {
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ type:'BUY', quantity:'', price:'', actual_investment:'', date:new Date().toISOString().slice(0,10) })
  const [saving, setSaving] = useState(false)
  const set = (k,v) => setForm(f=>({...f,[k]:v}))

  const mtfRate = parseFloat(trade.mtf_interest_rate) || 0

  const calcMTF = (exec) => {
    if (exec.type !== 'BUY' || !mtfRate || !exec.actual_investment) return null
    const mtfBase = (exec.quantity * exec.price) - exec.actual_investment
    if (mtfBase <= 0) return null
    const days = Math.max(1, Math.floor((new Date() - new Date(exec.date)) / 86400000))
    return (mtfBase * mtfRate * days) / 36500
  }

  const investedValue = form.quantity && form.price ? parseFloat(form.quantity) * parseFloat(form.price) : 0
  const mtfAmount = investedValue && form.actual_investment ? investedValue - parseFloat(form.actual_investment) : 0

  const submit = async () => {
    if (!form.quantity || !form.price || !form.date) return
    setSaving(true)
    await onAdd({ type:form.type, quantity:parseFloat(form.quantity), price:parseFloat(form.price), actual_investment:form.actual_investment?parseFloat(form.actual_investment):null, date:form.date })
    setForm({ type:'BUY', quantity:'', price:'', actual_investment:'', date:new Date().toISOString().slice(0,10) })
    setShowForm(false); setSaving(false)
  }

  const fld = { background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'4px', padding:'6px 10px', color:'var(--text)', fontSize:'12px', fontFamily:'DM Mono, monospace', outline:'none' }
  const lbl = { fontSize:'10px', color:'var(--muted)', fontWeight:600, letterSpacing:'0.08em', textTransform:'uppercase', display:'block', marginBottom:'3px' }
  const fmt = (n) => Number(n).toLocaleString('en-IN', { maximumFractionDigits:0 })
  const fmtd = (n) => Number(n).toLocaleString('en-IN', { maximumFractionDigits:2 })

  const totalMTF = executions.reduce((s,e) => s + (calcMTF(e)||0), 0)
  const totalBought = executions.filter(e=>e.type==='BUY').reduce((s,e)=>s+Number(e.quantity),0)
  const totalSold = executions.filter(e=>e.type==='SELL').reduce((s,e)=>s+Number(e.quantity),0)

  return (
    <div style={{ padding:'16px 24px', borderTop:'2px solid var(--accent)' }} onClick={e=>e.stopPropagation()}>

      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'14px' }}>
        <div style={{ display:'flex', alignItems:'center', gap:'12px' }}>
          <div style={{ fontSize:'11px', fontWeight:700, color:'var(--accent)', letterSpacing:'0.12em', textTransform:'uppercase' }}>
            Execution History — {trade.ticker}
          </div>
          {mtfRate > 0 && <div style={{ fontSize:'10px', color:'var(--gold)', background:'rgba(245,158,11,0.1)', padding:'2px 8px', borderRadius:'4px', fontFamily:'DM Mono, monospace' }}>MTF: {mtfRate}% p.a.</div>}
        </div>
        <button onClick={()=>setShowForm(v=>!v)} style={{ padding:'5px 14px', background:showForm?'var(--surface)':'var(--accent)', border:'1px solid var(--border)', borderRadius:'5px', color:showForm?'var(--muted)':'#fff', fontSize:'11px', fontFamily:'DM Mono, monospace', cursor:'pointer', fontWeight:600 }}>
          {showForm ? 'Cancel' : '+ Add Execution'}
        </button>
      </div>

      {showForm && (
        <div style={{ padding:'14px', background:'var(--surface)', borderRadius:'8px', border:'1px solid var(--border)', marginBottom:'14px' }}>
          <div style={{ display:'flex', gap:'10px', flexWrap:'wrap', alignItems:'flex-end' }}>
            <div>
              <label style={lbl}>Type</label>
              <div style={{ display:'flex', gap:'2px', background:'var(--bg)', borderRadius:'4px', border:'1px solid var(--border)', padding:'2px' }}>
                {['BUY','SELL'].map(typeOpt => (
                  <button key={typeOpt} onClick={()=>set('type',typeOpt)} style={{ padding:'5px 14px', border:'none', borderRadius:'3px', cursor:'pointer', fontSize:'11px', fontWeight:700, fontFamily:'DM Mono, monospace', background:form.type===typeOpt?(typeOpt==='BUY'?'var(--bull)':'var(--bear)'):'transparent', color:form.type===typeOpt?'#fff':'var(--muted)' }}>{typeOpt}</button>
                ))}
              </div>
            </div>
            <div><label style={lbl}>Quantity *</label><input type="number" placeholder="100" value={form.quantity} onChange={e=>set('quantity',e.target.value)} style={{ ...fld, width:'90px' }} /></div>
            <div><label style={lbl}>Price ₹ *</label><input type="number" placeholder="0.00" value={form.price} onChange={e=>set('price',e.target.value)} style={{ ...fld, width:'100px' }} /></div>
            {form.type==='BUY' && <div><label style={lbl}>Actual Inv ₹ (your money)</label><input type="number" placeholder="Your capital" value={form.actual_investment} onChange={e=>set('actual_investment',e.target.value)} style={{ ...fld, width:'130px' }} /></div>}
            <div><label style={lbl}>Date *</label><input type="date" value={form.date} onChange={e=>set('date',e.target.value)} style={{ ...fld, width:'140px' }} /></div>
            <button onClick={submit} disabled={saving} style={{ padding:'6px 20px', background:'var(--accent)', border:'none', borderRadius:'4px', color:'#fff', fontSize:'12px', fontWeight:700, cursor:'pointer', fontFamily:'DM Mono, monospace' }}>{saving?'...':'Save'}</button>
          </div>
          {form.type==='BUY' && investedValue>0 && form.actual_investment && mtfAmount>0 && (
            <div style={{ marginTop:'10px', display:'flex', gap:'20px', fontSize:'11px', fontFamily:'DM Mono, monospace', color:'var(--muted)' }}>
              <span>Total Value: <strong style={{ color:'var(--text)' }}>₹{fmt(investedValue)}</strong></span>
              <span>MTF Amount: <strong style={{ color:'var(--gold)' }}>₹{fmt(mtfAmount)}</strong></span>
              {mtfRate>0 && <span>Daily Interest: <strong style={{ color:'var(--gold)' }}>₹{fmtd((mtfAmount*mtfRate)/36500)}/day</strong></span>}
            </div>
          )}
        </div>
      )}

      {executions.length===0 ? (
        <div style={{ fontSize:'11px', color:'var(--muted)', padding:'12px 0' }}>No executions recorded yet. Click "+ Add Execution" to log your first buy or sell.</div>
      ) : (
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'12px' }}>
          <thead>
            <tr style={{ borderBottom:'1px solid var(--border)' }}>
              {['Type','Qty','Price ₹','Date','Value ₹','Actual Inv ₹','MTF Amt ₹','MTF Interest ₹',''].map(h => (
                <th key={h} style={{ padding:'6px 10px', textAlign:h===''||h==='Type'?'center':'right', fontSize:'9px', color:'var(--muted)', fontFamily:'DM Mono, monospace', fontWeight:600, letterSpacing:'0.08em', textTransform:'uppercase', whiteSpace:'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {executions.map((exec,i) => {
              const value = exec.quantity * exec.price
              const mtfAmt = exec.actual_investment ? value - exec.actual_investment : null
              const mtfInterest = calcMTF(exec)
              return (
                <tr key={exec.id} style={{ borderBottom:'1px solid var(--border)', background:i%2===0?'transparent':'rgba(0,0,0,0.015)' }}>
                  <td style={{ padding:'8px 10px', textAlign:'center' }}>
                    <span style={{ padding:'2px 10px', borderRadius:'3px', fontSize:'11px', fontWeight:700, fontFamily:'DM Mono, monospace', background:exec.type==='BUY'?'rgba(22,163,74,0.1)':'rgba(220,38,38,0.1)', color:exec.type==='BUY'?'var(--bull)':'var(--bear)' }}>{exec.type}</span>
                  </td>
                  <td style={{ padding:'8px 10px', textAlign:'right', fontFamily:'DM Mono, monospace', fontWeight:600 }}>{fmt(exec.quantity)}</td>
                  <td style={{ padding:'8px 10px', textAlign:'right', fontFamily:'DM Mono, monospace' }}>₹{Number(exec.price).toLocaleString('en-IN')}</td>
                  <td style={{ padding:'8px 10px', textAlign:'right', color:'var(--muted)', whiteSpace:'nowrap' }}>{exec.date}</td>
                  <td style={{ padding:'8px 10px', textAlign:'right', fontFamily:'DM Mono, monospace', fontWeight:600 }}>₹{fmt(value)}</td>
                  <td style={{ padding:'8px 10px', textAlign:'right', fontFamily:'DM Mono, monospace' }}>{exec.actual_investment?`₹${fmt(exec.actual_investment)}`:<span style={{ color:'var(--muted)' }}>—</span>}</td>
                  <td style={{ padding:'8px 10px', textAlign:'right', fontFamily:'DM Mono, monospace', color:'var(--gold)' }}>{mtfAmt&&mtfAmt>0?`₹${fmt(mtfAmt)}`:<span style={{ color:'var(--muted)' }}>—</span>}</td>
                  <td style={{ padding:'8px 10px', textAlign:'right', fontFamily:'DM Mono, monospace', fontWeight:600, color:'var(--gold)' }}>{mtfInterest?`₹${fmtd(mtfInterest)}`:<span style={{ color:'var(--muted)' }}>—</span>}</td>
                  <td style={{ padding:'8px 10px', textAlign:'center' }}>
                    <button onClick={()=>onDelete(exec.id)} style={{ background:'none', border:'none', color:'var(--bear)', cursor:'pointer', fontSize:'14px', lineHeight:1, padding:'0 4px' }}>×</button>
                  </td>
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr style={{ borderTop:'2px solid var(--border)', background:'var(--surface)' }}>
              <td colSpan={9} style={{ padding:'10px 12px' }}>
                <div style={{ display:'flex', gap:'24px', fontSize:'11px', fontFamily:'DM Mono, monospace', flexWrap:'wrap' }}>
                  <span><span style={{ color:'var(--muted)' }}>Total Bought: </span><span style={{ color:'var(--bull)', fontWeight:700 }}>{fmt(totalBought)} shares</span></span>
                  <span><span style={{ color:'var(--muted)' }}>Total Sold: </span><span style={{ color:'var(--bear)', fontWeight:700 }}>{fmt(totalSold)} shares</span></span>
                  <span><span style={{ color:'var(--muted)' }}>Remaining: </span><span style={{ fontWeight:700 }}>{fmt(totalBought-totalSold)} shares</span></span>
                  {totalMTF>0 && <span><span style={{ color:'var(--muted)' }}>Total MTF Interest: </span><span style={{ color:'var(--gold)', fontWeight:700 }}>₹{fmtd(totalMTF)}</span></span>}
                </div>
              </td>
            </tr>
          </tfoot>
        </table>
      )}
    </div>
  )
}

export default ExecutionPanel
