import React, { useState, useEffect, useCallback } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'
import { supabase } from '../lib/supabase'
import { differenceInDays } from 'date-fns'
import Sidebar from '../components/Sidebar'

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

function SubscriberPanel({ subscriber, isAdmin, getToken, toINRd, toINR, netPnL = 0 }) {
  const [settlements, setSettlements] = React.useState([])
  const [month, setMonth] = React.useState(new Date())
  const [modalDate, setModalDate] = React.useState(null)
  const [modalEdit, setModalEdit] = React.useState(null)
  const [form, setForm] = React.useState({ value:'', remarks:'' })
  const [saving, setSaving] = React.useState(false)
  const [editMode, setEditMode] = React.useState(false)
  const [editForm, setEditForm] = React.useState({ value:'', remarks:'' })
  const today = new Date()

  const load = React.useCallback(async () => {
    const token = await getToken()
    const res = await fetch(`/api/settlements?subscriber_id=${subscriber.id}`, { headers:{ Authorization:`Bearer ${token}` } })
    const data = await res.json()
    if (Array.isArray(data)) setSettlements(data)
  }, [subscriber.id, getToken])

  React.useEffect(() => { load() }, [load])

  const save = async () => {
    if (!form.value || saving) return
    setSaving(true)
    const token = await getToken()
    await fetch('/api/settlements', { method:'POST', headers:{'Content-Type':'application/json', Authorization:`Bearer ${token}`}, body: JSON.stringify({ subscriber_id: subscriber.id, date: modalDate, value: parseFloat(form.value), remarks: form.remarks }) })
    setSaving(false); setModalDate(null); await load()
  }

  const update = async () => {
    if (!editForm.value || saving) return
    setSaving(true)
    const token = await getToken()
    await fetch('/api/settlements', { method:'PUT', headers:{'Content-Type':'application/json', Authorization:`Bearer ${token}`}, body: JSON.stringify({ id: modalEdit.id, value: parseFloat(editForm.value), remarks: editForm.remarks }) })
    setSaving(false); setModalEdit(null); setEditMode(false); await load()
  }

  const remove = async (id) => {
    if (!confirm('🗑 Delete this settlement?\n\nThis settlement record will be permanently removed.')) return
    if (!confirm('⚠️ CONFIRM DELETE\n\nAre you sure? The Unsettled P&L will change after deletion.')) return
    const token = await getToken()
    await fetch('/api/settlements', { method:'DELETE', headers:{ 'Content-Type':'application/json', Authorization:`Bearer ${token}` }, body: JSON.stringify({ id }) })
    setModalEdit(null)
    await load()
  }

  // Calendar grid
  const year = month.getFullYear(), mon = month.getMonth()
  const firstDay = new Date(year, mon, 1).getDay()
  const daysInMonth = new Date(year, mon + 1, 0).getDate()
  const pad = firstDay === 0 ? 6 : firstDay - 1  // Mon-start
  const cells = []
  for (let i = 0; i < pad; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)

  const settlementMap = {}
  settlements.forEach(s => { settlementMap[s.date] = s })

  const totalSettled = settlements.reduce((s, x) => s + Number(x.value), 0)
  const unsettled = (netPnL || 0) - totalSettled

  const fmt = (y,m,d) => `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`

  return (
    <div style={{ width:'100%' }}>
      {/* Settlement tiles */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'6px', marginBottom:'8px' }}>
        <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'6px', padding:'7px 10px' }}>
          <div style={{ fontSize:'8px', color:'var(--muted)', fontFamily:'DM Mono, monospace', marginBottom:'3px', letterSpacing:'0.08em' }}>SETTLED P&L</div>
          <div style={{ fontSize:'12px', fontWeight:800, fontFamily:'DM Mono, monospace', color:totalSettled>=0?'var(--bull)':'var(--bear)' }}>
            {totalSettled>=0?'+':'−'}Rs.{toINRd(Math.abs(totalSettled))}
          </div>
        </div>
        <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'6px', padding:'7px 10px' }}>
          <div style={{ fontSize:'8px', color:'var(--muted)', fontFamily:'DM Mono, monospace', marginBottom:'3px', letterSpacing:'0.08em' }}>UNSETTLED P&L</div>
          <div style={{ fontSize:'12px', fontWeight:800, fontFamily:'DM Mono, monospace', color:unsettled>=0?'var(--bull)':'var(--bear)' }}>
            {unsettled>=0?'+':'−'}Rs.{toINRd(Math.abs(unsettled))}
          </div>
        </div>
      </div>

      {/* Calendar */}
      <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'8px', overflow:'hidden' }}>
        {/* Month nav */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'5px 8px', borderBottom:'1px solid var(--border)' }}>
          <button onClick={() => setMonth(new Date(year, mon-1, 1))} style={{ background:'none', border:'none', color:'var(--muted)', borderRadius:'3px', padding:'1px 6px', cursor:'pointer', fontSize:'12px' }}>‹</button>
          <span style={{ fontFamily:'DM Mono, monospace', fontWeight:700, fontSize:'10px', color:'var(--text)' }}>
            {month.toLocaleString('default',{month:'short'})} {year}
          </span>
          <button onClick={() => setMonth(new Date(year, mon+1, 1))} style={{ background:'none', border:'none', color:'var(--muted)', borderRadius:'3px', padding:'1px 6px', cursor:'pointer', fontSize:'12px' }}>›</button>
        </div>
        {/* Day headers */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', background:'var(--surface)' }}>
          {['M','T','W','T','F','S','S'].map((d,i) => (
            <div key={i} style={{ textAlign:'center', padding:'2px 0', fontSize:'8px', color:'var(--muted)', fontFamily:'DM Mono, monospace', fontWeight:600 }}>{d}</div>
          ))}
        </div>
        {/* Day cells */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:'1px', background:'var(--border)', padding:'1px' }}>
          {cells.map((d, i) => {
            if (!d) return <div key={i} style={{ background:'var(--bg)', minHeight:'28px' }} />
            const dateStr = fmt(year, mon, d)
            const settled = settlementMap[dateStr]
            const isToday = dateStr === fmt(today.getFullYear(), today.getMonth(), today.getDate())
            return (
              <div key={i}
                onClick={() => {
                  if (!isAdmin) return
                  if (settled) { setModalEdit(settled); setModalDate(null) }
                  else { setModalDate(dateStr); setForm({ value:'', remarks:'' }) }
                }}
                style={{
                  background: settled ? 'rgba(245,158,11,0.15)' : isToday ? 'var(--accent-dim)' : 'var(--surface)',
                  minHeight:'22px', display:'flex', flexDirection:'column', alignItems:'center',
                  justifyContent:'center', padding:'1px',
                  cursor: isAdmin ? 'pointer' : 'default',
                  transition:'background 0.1s',
                  borderRadius:'2px',
                }}
                onMouseEnter={e => { if (isAdmin) e.currentTarget.style.background = settled ? 'rgba(245,158,11,0.25)' : 'rgba(14,165,233,0.1)' }}
                onMouseLeave={e => { e.currentTarget.style.background = settled ? 'rgba(245,158,11,0.15)' : isToday ? 'var(--accent-dim)' : 'var(--surface)' }}
              >
                <span style={{ fontSize:'9px', fontFamily:'DM Mono, monospace', color: settled?'var(--gold)': isToday?'var(--accent)':'var(--muted)', fontWeight: isToday||settled?700:400 }}>{d}</span>
                {settled && <span style={{ fontSize:'8px', color:'var(--gold)', fontFamily:'DM Mono, monospace', lineHeight:1 }}>✓</span>}
              </div>
            )
          })}
        </div>
        {isAdmin && <div style={{ padding:'3px 8px', fontSize:'8px', color:'var(--muted)', fontFamily:'DM Mono, monospace', borderTop:'1px solid var(--border)' }}>Click date to record settlement</div>}
      </div>

      {/* Settlement list */}
      {settlements.length > 0 && (
        <div style={{ marginTop:'8px', maxHeight:'120px', overflowY:'auto' }}>
          {[...settlements].reverse().map(s => (
            <div key={s.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'5px 8px', background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'6px', marginBottom:'4px', fontSize:'11px' }}>
              <span style={{ fontFamily:'DM Mono, monospace', color:'var(--muted)', fontSize:'10px' }}>{s.date}</span>
              <span style={{ fontFamily:'DM Mono, monospace', fontWeight:700, color:Number(s.value)>=0?'var(--bull)':'var(--bear)' }}>
                {Number(s.value)>=0?'+':'−'}Rs.{toINRd(Math.abs(Number(s.value)))}
              </span>
              {s.remarks && <span style={{ color:'var(--muted)', fontSize:'10px', maxWidth:'80px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{s.remarks}</span>}
              {isAdmin && <button onClick={() => remove(s.id)} style={{ background:'none', border:'none', color:'var(--bear)', cursor:'pointer', fontSize:'12px', padding:'0 2px' }}>×</button>}
            </div>
          ))}
        </div>
      )}

      {/* Add modal */}
      {modalDate && isAdmin && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.6)', zIndex:2000, display:'flex', alignItems:'center', justifyContent:'center' }}>
          <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'12px', padding:'24px', width:'320px', boxShadow:'0 20px 60px rgba(0,0,0,0.5)' }}>
            <div style={{ fontFamily:'Bookman Old Style, serif', fontWeight:700, fontSize:'15px', color:'var(--text)', marginBottom:'16px' }}>
              Record Settlement — {modalDate}
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:'12px' }}>
              <div>
                <div style={{ fontSize:'10px', color:'var(--muted)', fontFamily:'DM Mono, monospace', marginBottom:'4px' }}>VALUE (Rs.)</div>
                <input type="number" value={form.value} onChange={e=>setForm(p=>({...p,value:e.target.value}))}
                  placeholder="e.g. 5000"
                  style={{ width:'100%', background:'var(--bg)', border:'1px solid var(--border)', borderRadius:'6px', padding:'8px 10px', color:'var(--text)', fontSize:'13px', fontFamily:'DM Mono, monospace', boxSizing:'border-box' }} />
              </div>
              <div>
                <div style={{ fontSize:'10px', color:'var(--muted)', fontFamily:'DM Mono, monospace', marginBottom:'4px' }}>REMARKS (optional)</div>
                <input type="text" value={form.remarks} onChange={e=>setForm(p=>({...p,remarks:e.target.value}))}
                  placeholder="e.g. NEFT transfer"
                  style={{ width:'100%', background:'var(--bg)', border:'1px solid var(--border)', borderRadius:'6px', padding:'8px 10px', color:'var(--text)', fontSize:'13px', fontFamily:'DM Mono, monospace', boxSizing:'border-box' }} />
              </div>
            </div>
            <div style={{ display:'flex', gap:'8px', marginTop:'18px' }}>
              <button onClick={save} disabled={!form.value||saving}
                style={{ flex:1, padding:'9px', background:'var(--accent)', color:'#fff', border:'none', borderRadius:'6px', cursor:'pointer', fontFamily:'DM Mono, monospace', fontWeight:700, fontSize:'12px', opacity:!form.value||saving?0.5:1 }}>
                {saving ? 'Saving...' : 'Save'}
              </button>
              <button onClick={() => setModalDate(null)}
                style={{ flex:1, padding:'9px', background:'none', border:'1px solid var(--border)', color:'var(--muted)', borderRadius:'6px', cursor:'pointer', fontFamily:'DM Mono, monospace', fontSize:'12px' }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View/Edit/Delete settlement modal */}
      {modalEdit && isAdmin && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.6)', zIndex:2000, display:'flex', alignItems:'center', justifyContent:'center' }}>
          <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'12px', padding:'24px', width:'340px', boxShadow:'0 20px 60px rgba(0,0,0,0.5)' }}>
            <div style={{ fontFamily:'Bookman Old Style, serif', fontWeight:700, fontSize:'15px', color:'var(--text)', marginBottom:'12px' }}>
              Settlement — {modalEdit.date}
            </div>
            {!editMode ? (
              <>
                <div style={{ fontFamily:'DM Mono, monospace', fontSize:'22px', fontWeight:800, color:Number(modalEdit.value)>=0?'var(--bull)':'var(--bear)', marginBottom:'4px' }}>
                  {Number(modalEdit.value)>=0?'+':'−'}Rs.{toINRd(Math.abs(Number(modalEdit.value)))}
                </div>
                {modalEdit.remarks && <div style={{ fontSize:'12px', color:'var(--muted)', marginBottom:'12px', fontFamily:'DM Mono, monospace' }}>{modalEdit.remarks}</div>}
                <div style={{ display:'flex', gap:'8px', marginTop:'16px' }}>
                  <button onClick={() => { setEditForm({ value: modalEdit.value, remarks: modalEdit.remarks || '' }); setEditMode(true) }}
                    style={{ flex:1, padding:'9px', background:'var(--accent)', color:'#fff', border:'none', borderRadius:'6px', cursor:'pointer', fontFamily:'DM Mono, monospace', fontWeight:700, fontSize:'12px' }}>
                    ✏ Edit
                  </button>
                  <button onClick={() => remove(modalEdit.id)}
                    style={{ flex:1, padding:'9px', background:'var(--bear)', color:'#fff', border:'none', borderRadius:'6px', cursor:'pointer', fontFamily:'DM Mono, monospace', fontWeight:700, fontSize:'12px' }}>
                    🗑 Delete
                  </button>
                  <button onClick={() => { setModalEdit(null); setEditMode(false) }}
                    style={{ flex:1, padding:'9px', background:'none', border:'1px solid var(--border)', color:'var(--muted)', borderRadius:'6px', cursor:'pointer', fontFamily:'DM Mono, monospace', fontSize:'12px' }}>
                    Close
                  </button>
                </div>
              </>
            ) : (
              <>
                <div style={{ display:'flex', flexDirection:'column', gap:'12px' }}>
                  <div>
                    <div style={{ fontSize:'10px', color:'var(--muted)', fontFamily:'DM Mono, monospace', marginBottom:'4px' }}>VALUE (Rs.)</div>
                    <input type="number" value={editForm.value} onChange={e=>setEditForm(p=>({...p,value:e.target.value}))}
                      style={{ width:'100%', background:'var(--bg)', border:'1px solid var(--accent)', borderRadius:'6px', padding:'8px 10px', color:'var(--text)', fontSize:'13px', fontFamily:'DM Mono, monospace', boxSizing:'border-box' }} />
                  </div>
                  <div>
                    <div style={{ fontSize:'10px', color:'var(--muted)', fontFamily:'DM Mono, monospace', marginBottom:'4px' }}>REMARKS (optional)</div>
                    <input type="text" value={editForm.remarks} onChange={e=>setEditForm(p=>({...p,remarks:e.target.value}))}
                      style={{ width:'100%', background:'var(--bg)', border:'1px solid var(--border)', borderRadius:'6px', padding:'8px 10px', color:'var(--text)', fontSize:'13px', fontFamily:'DM Mono, monospace', boxSizing:'border-box' }} />
                  </div>
                </div>
                <div style={{ display:'flex', gap:'8px', marginTop:'16px' }}>
                  <button onClick={update} disabled={!editForm.value||saving}
                    style={{ flex:1, padding:'9px', background:'var(--accent)', color:'#fff', border:'none', borderRadius:'6px', cursor:'pointer', fontFamily:'DM Mono, monospace', fontWeight:700, fontSize:'12px', opacity:!editForm.value||saving?0.5:1 }}>
                    {saving ? 'Saving...' : '✓ Update'}
                  </button>
                  <button onClick={() => setEditMode(false)}
                    style={{ flex:1, padding:'9px', background:'none', border:'1px solid var(--border)', color:'var(--muted)', borderRadius:'6px', cursor:'pointer', fontFamily:'DM Mono, monospace', fontSize:'12px' }}>
                    ← Back
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )


}

export default function RevenueSharingPage() {
  const router = useRouter()
  const [session, setSession] = useState(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(false)

  const [subscribers, setSubscribers] = useState([])
  const [selectedSub, setSelectedSub] = useState(null)
  const [subTrades, setSubTrades] = useState([])
  const [subExecs, setSubExecs] = useState([])
  const [subLoading, setSubLoading] = useState(false)
  const [subNetPnL, setSubNetPnL] = useState(0)

  const [ownTrades, setOwnTrades] = useState([])
  const [ownExecs, setOwnExecs] = useState({})
  const [ownNetPnL, setOwnNetPnL] = useState(0)

  const toINRd = n => Number(n||0).toLocaleString('en-IN', { minimumFractionDigits:2, maximumFractionDigits:2 })
  const getToken = useCallback(async () => (await supabase.auth.getSession()).data.session?.access_token, [])

  useEffect(() => {
    supabase.auth.getSession().then(({ data:{ session:s } }) => {
      if (!s) { router.push('/'); return }
      setSession(s); setIsAdmin(s.user.email === ADMIN_EMAIL)
    })
    const { data:{ subscription } } = supabase.auth.onAuthStateChange((event, s) => {
      if (event === 'SIGNED_IN' && s) { setSession(s); setIsAdmin(s.user.email === ADMIN_EMAIL) }
      if (!s) router.push('/')
    })
    return () => subscription.unsubscribe()
  }, []) // eslint-disable-line

  useEffect(() => {
    if (!session) return
    if (isAdmin) loadSubscribers()
    else loadOwnTrades()
  }, [session, isAdmin]) // eslint-disable-line

  const loadSubscribers = async () => {
    setLoading(true)
    const token = await getToken()
    const res = await fetch('/api/admin/subscribers', { headers:{ Authorization:`Bearer ${token}` } })
    const data = await res.json()
    if (Array.isArray(data)) setSubscribers(data.filter(s => s.email !== ADMIN_EMAIL))
    setLoading(false)
  }

  const loadOwnTrades = async () => {
    setLoading(true)
    const token = await getToken()
    const tRes = await fetch('/api/trades', { headers:{ Authorization:`Bearer ${token}` } })
    const tData = await tRes.json()
    if (!Array.isArray(tData)) { setLoading(false); return }
    setOwnTrades(tData)
    // ownNetPnL computed after executions load (see useEffect below)
    const mtfTrades = tData.filter(t => Number(t.actual_investment) > 0)
    if (mtfTrades.length > 0) {
      const results = await Promise.all(mtfTrades.map(t =>
        fetch(`/api/executions?trade_id=${t.id}`, { headers:{ Authorization:`Bearer ${token}` } }).then(r=>r.json()).catch(()=>[])
      ))
      const flat = []; results.forEach(r => { if (Array.isArray(r)) r.forEach(e => flat.push(e)) })
      setOwnExecs(flat)
      // Compute ownNetPnL using buildSummary
      const ownSum = buildSummary(tData, flat)
      setOwnNetPnL(ownSum.netPnLAdmin)
    } else {
      const ownSum = buildSummary(tData, [])
      setOwnNetPnL(ownSum.netPnLAdmin)
    }
    setLoading(false)
  }

  const loadSubTrades = async (sub) => {
    if (selectedSub?.id === sub.id) { setSelectedSub(null); setSubTrades([]); setSubExecs([]); return }
    setSelectedSub(sub); setSubTrades([]); setSubExecs([])
    setSubLoading(true)
    const token = await getToken()
    const res = await fetch(`/api/admin/subscriber-trades?user_id=${sub.id}`, { headers:{ Authorization:`Bearer ${token}` } })
    const data = await res.json()
    const loadedTrades = data.trades || []
    const loadedExecs  = data.executions || []
    setSubTrades(loadedTrades); setSubExecs(loadedExecs)
    // Compute netPnLAdmin using same calcTradePnL logic
    const subSummary = buildSummary(loadedTrades, loadedExecs)
    setSubNetPnL(subSummary.netPnLAdmin)
    setSubLoading(false)
  }

  const signOut = async () => { await supabase.auth.signOut(); window.location.href = '/' }

  const calcTradePnL = (trade, execs) => {
    const investment  = Number(trade.invested_capital) || (Number(trade.entry_price) * Number(trade.quantity))
    const actualInv   = Number(trade.actual_investment) || 0
    const mtfRate     = Number(trade.mtf_interest_rate) || 0
    const entryPrice  = Number(trade.entry_price) || 0
    const originalQty = Number(trade.quantity) || 0
    const tradeExecs  = execs.filter(e => e.trade_id === trade.id)
    const mtfBase     = actualInv > 0 ? investment - actualInv : 0
    let mtfInt = 0, mtfIntClosed = 0
    if (mtfBase > 0 && mtfRate && trade.entry_date) {
      const soldMtf = tradeExecs.reduce((s, e) => {
        const days = Math.max(1, Math.floor((new Date(e.date) - new Date(trade.entry_date)) / 86400000))
        return s + mtfBase * (Number(e.quantity)/originalQty) * mtfRate * days / 36500
      }, 0)
      const totalSold = tradeExecs.reduce((s,e) => s + Number(e.quantity), 0)
      const remQty = Math.max(0, originalQty - totalSold)
      const remDays = Math.max(1, Math.floor((new Date() - new Date(trade.entry_date)) / 86400000))
      const remMtf = trade.status === 'OPEN' ? mtfBase*(remQty/originalQty)*mtfRate*remDays/36500 : 0
      mtfIntClosed = soldMtf + (trade.status === 'CLOSED' ? remMtf : 0)
      mtfInt = soldMtf + remMtf
    }
    let grossPnL = 0
    if (tradeExecs.length > 0) {
      // P&L only on sold/executed portions
      grossPnL = tradeExecs.reduce((s,e) => s + (Number(e.price) - entryPrice) * Number(e.quantity), 0)
    } else if (trade.status === 'CLOSED') {
      // Closed trade with no execution records — use realized_gains fallback
      grossPnL = Number(trade.realized_gains) || 0
    }
    // OPEN trade with no executions = 0 (unrealised, excluded from gross P&L)
    const adminRatio = investment > 0 && actualInv > 0 ? (investment - actualInv) / investment : 0
    const grossPnLAdmin = grossPnL * adminRatio
    const netPnLAdmin   = grossPnLAdmin - mtfIntClosed
    const exitPrice = tradeExecs.length > 0
      ? tradeExecs.reduce((s,e)=>s+Number(e.price)*Number(e.quantity),0)/tradeExecs.reduce((s,e)=>s+Number(e.quantity),0)
      : Number(trade.exit_price) || null
    return { investment, actualInv, mtfInt, mtfIntClosed, grossPnL, grossPnLAdmin, netPnLAdmin, exitPrice, originalQty, entryPrice, adminRatio }
  }

  const buildSummary = (trades, execs) => {
    const mtfTrades = trades.filter(t => Number(t.actual_investment) > 0)
    return mtfTrades.reduce((acc, t) => {
      const r = calcTradePnL(t, execs)
      // grossPnL & admin P&L: only add for CLOSED trades or partial sells
      // open trades with no executions contribute 0 (already handled in calcTradePnL)
      return {
        grossPnL:      acc.grossPnL      + r.grossPnL,
        grossPnLAdmin: acc.grossPnLAdmin + r.grossPnLAdmin,
        netPnLAdmin:   acc.netPnLAdmin   + r.netPnLAdmin,
        mtfInt:        acc.mtfInt        + r.mtfInt,
        mtfIntClosed:  acc.mtfIntClosed  + r.mtfIntClosed,
        mtfIntOpen:    acc.mtfIntOpen    + (r.mtfInt - r.mtfIntClosed),
        count:         acc.count         + 1,
        closedCount:   acc.closedCount   + (t.status === 'CLOSED' ? 1 : 0),
      }
    }, { grossPnL:0, grossPnLAdmin:0, netPnLAdmin:0, mtfInt:0, mtfIntClosed:0, mtfIntOpen:0, count:0, closedCount:0 })
  }

  const TradeTable = ({ trades, execs, subscriberId }) => {
    const [statusFilter, setStatusFilter] = React.useState('ALL')

    const [sortCol, setSortCol] = React.useState(null)
    const [sortDir, setSortDir] = React.useState('asc')
    const doSort = (col) => { if(sortCol===col) setSortDir(d=>d==='asc'?'desc':'asc'); else { setSortCol(col); setSortDir('asc') } }
    const sortIcon = (col) => sortCol===col ? (sortDir==='asc'?' ↑':' ↓') : ' ↕'
    const applySort = (list) => {
      if (!sortCol) return list
      return [...list].sort((a,b) => { let av=a[sortCol]??'',bv=b[sortCol]??''; if(typeof av==='string') av=av.toLowerCase(),bv=bv.toLowerCase(); return sortDir==='asc'?(av>bv?1:-1):(av<bv?1:-1) })
    }
    const downloadCSV = () => {
      const h=['Ticker','Entry Date','Entry Price','Exit Price','Qty','Investment','Admin%','Gross P&L','Net P&L Admin']
      const rows=mtfTrades.map(t=>{ const r=calcTradePnL(t,execs); return [t.ticker,t.entry_date,r.entryPrice,r.exitPrice||'',r.originalQty,r.investment,(r.adminRatio*100).toFixed(1)+'%',r.grossPnL.toFixed(2),r.netPnLAdmin.toFixed(2)] })
      const csv=[h,...rows].map(r=>r.join(',')).join('\n')
      triggerCSVDownload(csv, 'revenue-sharing.csv')
    }
    const allMtfTrades = trades.filter(t => Number(t.actual_investment) > 0)
    const mtfTrades = statusFilter === 'ALL' ? allMtfTrades : allMtfTrades.filter(t => t.status === statusFilter)
    if (allMtfTrades.length === 0) return (
      <div style={{ color:'var(--muted)', fontSize:'13px', padding:'24px', textAlign:'center' }}>
        No MTF trades found. Revenue sharing applies only to trades with "Actual Investment" set.
      </div>
    )
    const summary = buildSummary(allMtfTrades, execs)
    return (
      <div style={{ display:'flex', gap:'20px', alignItems:'flex-start', flexWrap:'wrap' }}>
        {/* Left: stats + table */}
        <div style={{ flex:1, minWidth:'0' }}>
          {/* Summary stat cards */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))', gap:'10px', marginBottom:'16px' }}>
            {[
              { label:'Gross P&L (Trade)',   value:`${summary.grossPnL>=0?'+':'−'}${toINRd(Math.abs(summary.grossPnL))}`, color:summary.grossPnL>=0?'var(--bull)':'var(--bear)' },
              { label:'Gross P&L (Admin)',   value:`${summary.grossPnLAdmin>=0?'+':'−'}${toINRd(Math.abs(summary.grossPnLAdmin))}`, color:summary.grossPnLAdmin>=0?'var(--bull)':'var(--bear)' },
              { label:'MTF Interest (Closed)', value:`Rs.${toINRd(summary.mtfIntClosed)}`, color:'var(--gold)' },
              { label:'MTF Interest (Open)',   value:`Rs.${toINRd(summary.mtfIntOpen)}`, color:'rgba(245,158,11,0.6)' },
              { label:'Net P&L (Admin)',      value:`${summary.netPnLAdmin>=0?'+':'−'}${toINRd(Math.abs(summary.netPnLAdmin))}`, color:summary.netPnLAdmin>=0?'var(--bull)':'var(--bear)' },
              { label:'MTF Trades', value:`${summary.count} (${summary.closedCount} closed)`, color:'var(--text)' },
            ].map(({ label, value, color }) => (
              <div key={label} style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'8px', padding:'12px 14px' }}>
                <div style={{ fontSize:'9px', color:'var(--muted)', fontFamily:'DM Mono, monospace', marginBottom:'5px' }}>{label}</div>
                <div style={{ fontSize:'15px', fontWeight:700, fontFamily:'DM Mono, monospace', color }}>{value}</div>
              </div>
            ))}
          </div>

          {/* Filter tabs */}
          <div style={{ display:'flex', justifyContent:'flex-end', gap:'6px', marginBottom:'10px' }}>
            <button onClick={downloadCSV} style={{ padding:'5px 12px', background:'var(--surface)', border:'1px solid var(--border)', color:'var(--muted)', borderRadius:'4px', cursor:'pointer', fontSize:'10px', fontFamily:'DM Mono, monospace', marginRight:'6px' }}>⬇ CSV</button>
          {['ALL','OPEN','CLOSED'].map(f => (
              <button key={f} onClick={() => setStatusFilter(f)} style={{
                padding:'5px 14px', borderRadius:'4px', cursor:'pointer', fontSize:'10px',
                fontFamily:'DM Mono, monospace', fontWeight:600,
                border:`1px solid ${statusFilter===f?'var(--accent)':'var(--border)'}`,
                background: statusFilter===f ? 'var(--accent-dim)' : 'transparent',
                color: statusFilter===f ? 'var(--accent)' : 'var(--muted)'
              }}>
                {f} ({f==='ALL'?allMtfTrades.length:allMtfTrades.filter(t=>t.status===f).length})
              </button>
            ))}
          </div>

          {/* Trade table */}
          <div style={{ border:'1px solid var(--border)', borderRadius:'8px', overflow:'hidden' }}>
            <table className="data-table">
              <colgroup>
                <col style={{ width:'10%' }} />
                <col style={{ width:'8%' }} />
                <col style={{ width:'8%' }} />
                <col style={{ width:'8%' }} />
                <col style={{ width:'6%' }} />
                <col style={{ width:'10%' }} />
                <col style={{ width:'6%' }} />
                <col style={{ width:'8%' }} />
                <col style={{ width:'10%' }} />
                <col style={{ width:'11%' }} />
                <col style={{ width:'15%' }} />
              </colgroup>
              <thead>
                <tr>
                  <th onClick={() => doSort('ticker')} style={{ cursor:'pointer', userSelect:'none' }}>Ticker{sortIcon('ticker')}</th>
                  <th onClick={() => doSort('entry_date')} style={{ cursor:'pointer', userSelect:'none' }}>Entry Date{sortIcon('entry_date')}</th>
                  <th className="r">Entry Rs.</th>
                  <th className="r">Exit Rs.</th>
                  <th className="r">Qty</th>
                  <th className="r">Inv / Actual</th>
                  <th className="r">Admin %</th>
                  <th className="r">MTF Int</th>
                  <th className="r">Gross P&L</th>
                  <th className="r">Gross (Admin)</th>
                  <th className="r">Net (Admin)</th>
                </tr>
              </thead>
              <tbody>
                {applySort(mtfTrades).map(trade => {
                  const r = calcTradePnL(trade, execs)
                  return (
                    <tr key={trade.id}>
                      <td>
                        <div className="tk-cell">
                          <span className="tk-name">{trade.ticker}</span>
                          <div className="tk-badges">
                            {trade.status==='OPEN' ? <span className="st-open">OPEN</span> : <span className="st-closed">CLOSED</span>}
                          </div>
                        </div>
                      </td>
                      <td style={{ fontSize:'11px', color:'var(--muted)' }}>{trade.entry_date?.slice(0,10)}</td>
                      <td className="num">Rs.{toINRd(r.entryPrice)}</td>
                      <td className="num">{r.exitPrice?`Rs.${toINRd(r.exitPrice)}`:<span style={{color:'var(--muted)'}}>—</span>}</td>
                      <td className="num">{Number(r.originalQty).toLocaleString('en-IN')}</td>
                      <td className="num">
                        <div className="sc">
                          <span className="sc1">Rs.{toINRd(r.investment)}</span>
                          <span className="sc2">Rs.{toINRd(r.actualInv)}</span>
                        </div>
                      </td>
                      <td className="num"><span className="mtf-val">{(r.adminRatio*100).toFixed(1)}%</span></td>
                      <td className="num">{r.mtfInt>0?<span className="mtf-val">Rs.{toINRd(r.mtfInt)}</span>:<span style={{color:'var(--muted)'}}>—</span>}</td>
                      <td className="num"><span className={r.grossPnL>=0?'pnl-pos':'pnl-neg'}>{r.grossPnL>=0?'+':'−'}Rs.{toINRd(Math.abs(r.grossPnL))}</span></td>
                      <td className="num"><span className={r.grossPnLAdmin>=0?'pnl-pos':'pnl-neg'}>{r.grossPnLAdmin>=0?'+':'−'}Rs.{toINRd(Math.abs(r.grossPnLAdmin))}</span></td>
                      <td className="num"><span style={{fontWeight:700,fontSize:'12px',color:r.netPnLAdmin>=0?'var(--bull)':'var(--bear)',background:r.netPnLAdmin>=0?'rgba(0,230,118,0.06)':'rgba(239,68,68,0.06)',padding:'2px 6px',borderRadius:'4px'}}>{r.netPnLAdmin>=0?'+':'−'}Rs.{toINRd(Math.abs(r.netPnLAdmin))}</span></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div style={{ fontSize:'10px', color:'var(--muted)', marginTop:'8px', fontFamily:'DM Mono, monospace' }}>
            Net P&L Admin = Gross P&L Admin − MTF Interest (closed trades only)
          </div>
        </div>

      </div>
    )
  }

  if (!session) return null

  return (
    <>
      <Head><title>Revenue Sharing — CHiiRAG Stock Journal</title></Head>
      <div className="tricolor-bar" />
      <Sidebar active="Revenue Sharing" isAdmin={isAdmin} user={session?.user} onSignOut={signOut} />

      <main className="sidebar-offset" style={{ padding:'28px 32px 40px' }}>
        <div style={{ marginBottom:'24px' }}>
          <h1 style={{ fontFamily:'Bookman Old Style, serif', fontSize:'22px', fontWeight:800, color:'var(--text)', margin:0 }}>Revenue Sharing</h1>
          <p style={{ color:'var(--muted)', fontSize:'12px', marginTop:'6px', fontFamily:'DM Mono, monospace' }}>MTF profit sharing — tracks admin gross & net P&L · settlement calendar per subscriber</p>
        </div>

        {loading ? (
          <div style={{ color:'var(--muted)', padding:'40px', textAlign:'center' }}>Loading...</div>
        ) : isAdmin ? (
          <div>
            {/* Subscriber tiles */}
            <div style={{ display:'flex', gap:'10px', flexWrap:'wrap', marginBottom:'28px' }}>
              {subscribers.length === 0
                ? <div style={{ color:'var(--muted)', fontSize:'13px' }}>No subscribers found.</div>
                : subscribers.map(sub => {
                  const isSel = selectedSub?.id === sub.id
                  return (
                    <div key={sub.id} onClick={() => loadSubTrades(sub)}
                      style={{ border:`2px solid ${isSel?'var(--accent)':'var(--border)'}`, background:isSel?'var(--accent-dim)':'var(--surface)', borderRadius:'10px', padding:'14px 20px', cursor:'pointer', minWidth:'140px', transition:'all 0.15s' }}
                      onMouseEnter={e => { if (!isSel) e.currentTarget.style.borderColor='var(--accent)' }}
                      onMouseLeave={e => { if (!isSel) e.currentTarget.style.borderColor='var(--border)' }}>
                      <div style={{ fontFamily:'DM Mono, monospace', fontWeight:700, fontSize:'13px', color:isSel?'var(--accent)':'var(--text)' }}>{sub.full_name||sub.email?.split('@')[0]}</div>
                      <div style={{ fontSize:'10px', color:'var(--muted)', marginTop:'4px' }}>{sub.totalTrades} trades</div>
                      <div style={{ fontSize:'9px', color:isSel?'var(--accent)':'var(--muted)', marginTop:'2px', fontFamily:'DM Mono, monospace' }}>{isSel?'▼ viewing':'▶ click to view'}</div>
                    </div>
                  )
                })}
            </div>

            {selectedSub && (
              <div style={{ borderTop:'2px solid var(--accent)', paddingTop:'24px' }}>
                <div style={{ display:'flex', alignItems:'center', gap:'12px', marginBottom:'20px' }}>
                  <h2 style={{ fontFamily:'Bookman Old Style, serif', fontSize:'17px', fontWeight:700, margin:0, color:'var(--text)' }}>
                    {selectedSub.full_name||selectedSub.email}'s Revenue Share
                  </h2>
                  <span style={{ fontSize:'10px', background:'var(--accent-dim)', color:'var(--accent)', padding:'2px 8px', borderRadius:'4px', fontFamily:'DM Mono, monospace' }}>MTF TRADES ONLY</span>
                </div>
                {subLoading
                  ? <div style={{ color:'var(--muted)', padding:'20px' }}>Loading trades...</div>
                  : <>
                      <SubscriberPanel subscriber={selectedSub} isAdmin={isAdmin} getToken={getToken} toINRd={toINRd} toINR={n => Number(n||0).toLocaleString('en-IN',{maximumFractionDigits:0})} netPnL={subNetPnL} />
                      <div style={{ marginTop:'20px' }}>
                        <TradeTable trades={subTrades} execs={subExecs} subscriberId={selectedSub.id} />
                      </div>
                    </>
                }
              </div>
            )}
          </div>
        ) : (
          <div>
            <div style={{ marginBottom:'20px', display:'flex', alignItems:'center', gap:'10px' }}>
              <h2 style={{ fontFamily:'Bookman Old Style, serif', fontSize:'17px', fontWeight:700, margin:0 }}>My Revenue Share</h2>
              <span style={{ fontSize:'10px', background:'var(--accent-dim)', color:'var(--accent)', padding:'2px 8px', borderRadius:'4px', fontFamily:'DM Mono, monospace' }}>MTF TRADES ONLY</span>
            </div>
            <SubscriberPanel subscriber={{ id: session.user.id, full_name: 'My Account' }} isAdmin={isAdmin} getToken={getToken} toINRd={toINRd} toINR={n => Number(n||0).toLocaleString('en-IN',{maximumFractionDigits:0})} netPnL={ownNetPnL} />
            <div style={{ marginTop:'20px' }}>
              <TradeTable trades={ownTrades} execs={ownExecs} subscriberId={session.user.id} />
            </div>
          </div>
        )}
      </main>
    </>
  )
}
