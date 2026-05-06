import React, { useState, useEffect, useCallback, useMemo } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'
import { supabase } from '../lib/supabase'
import { differenceInDays } from 'date-fns'
import AddTradeModal from '../components/AddTradeModal'
import EditTradeModal from '../components/EditTradeModal'
import ExecutionPanel from '../components/ExecutionPanel'
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
function MirroredView({ mirrorInfo, mTrades, mExecs, mExecsMap, mirrorFilter, setMirrorFilter, livePrices, toINRd, toINR, loadMirroredTrades, activeMirror, selectedMonth, setSelectedMonth }) {
  const mColumns = React.useMemo(() => [
    { key: 'ticker', filterable: true, sortable: true },
    { key: 'account', filterable: true, sortable: true },
    { key: 'entry_date', sortable: true },
    { key: 'entry_price', sortable: true, getSortValue: t => Number(t.entry_price) || 0 },
    { key: 'cmp', sortable: true, getSortValue: t => livePrices[t.ticker]?.price || 0 },
    { key: 'exit_price', sortable: true, getSortValue: t => Number(t.exit_price) || 0 },
    { key: 'quantity', sortable: true, getSortValue: t => Number(t.quantity) || 0 },
    { key: 'invested_capital', sortable: true, getSortValue: t => Number(t.invested_capital) || 0 },
    { key: 'mtf_int', sortable: true, getSortValue: t => {
      const xs = mExecs.filter(e => e.trade_id === t.id)
      const orig = Number(t.quantity) || 0
      const curr = Math.max(0, orig - xs.reduce((s,e) => s+Number(e.quantity), 0))
      const inv = Number(t.invested_capital) || (Number(t.entry_price)*orig)
      const base = inv - (Number(t.actual_investment)||0)
      if (!base || !t.mtf_interest_rate || !t.entry_date) return 0
      return base*(curr/orig)*t.mtf_interest_rate*Math.max(1,Math.floor((new Date()-new Date(t.entry_date))/86400000))/36500
    }},
    { key: 'unrealised', sortable: true, getSortValue: t => {
      const xs = mExecs.filter(e => e.trade_id === t.id)
      const orig = Number(t.quantity) || 0
      const curr = Math.max(0, orig - xs.reduce((s,e) => s+Number(e.quantity), 0))
      const entry = Number(t.entry_price) || 0
      const lp = livePrices[t.ticker]?.price
      if (!lp || curr === 0) return -Infinity
      return t.direction === 'LONG' ? (lp-entry)*curr : (entry-lp)*curr
    }},
    { key: 'realised', sortable: true, getSortValue: t => {
      const xs = mExecs.filter(e => e.trade_id === t.id)
      const entry = Number(t.entry_price) || 0
      return xs.length > 0 ? xs.reduce((s,e) => s+(Number(e.price)-entry)*Number(e.quantity), 0) : (Number(t.realized_gains)||0)
    }},
    { key: 'status', filterable: true, sortable: true },
  ], [mExecs, livePrices])

  const baseFiltered = mirrorFilter === 'ALL' ? mTrades : mTrades.filter(t => t.status === mirrorFilter)
  const mTf = useTableFilter(baseFiltered, mColumns)
  return (
    <div style={{ display:'flex', gap:'16px', alignItems:'flex-start' }}>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'14px', flexWrap:'wrap', gap:'8px' }}>
          <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
            <span style={{ fontSize:'13px', fontWeight:700, color:'var(--gold)', fontFamily:'DM Mono, monospace' }}>{mirrorInfo?.subscriber_name}'s Portfolio</span>
            <span style={{ fontSize:'10px', background:'rgba(245,158,11,0.1)', color:'var(--gold)', padding:'2px 8px', borderRadius:'4px', fontFamily:'DM Mono, monospace' }}>READ ONLY · LIVE SYNC</span>

          </div>
          <div style={{ display:'flex', gap:'6px', alignItems:'center' }}>
            {['ALL','OPEN','CLOSED'].map(f => (
              <button key={f} onClick={() => setMirrorFilter(f)}
                style={{ padding:'4px 12px', borderRadius:'4px', border:`1px solid ${mirrorFilter===f?'var(--gold)':'var(--border)'}`, background:mirrorFilter===f?'rgba(245,158,11,0.1)':'transparent', color:mirrorFilter===f?'var(--gold)':'var(--muted)', cursor:'pointer', fontSize:'10px', fontFamily:'DM Mono, monospace', fontWeight:600 }}>
                {f} ({f==='ALL'?mTrades.length:mTrades.filter(t=>t.status===f).length})
              </button>
            ))}
            <button onClick={() => {
              const headers = ['Ticker','Direction','Account','Entry Date','Entry Price','Exit Price','Qty','Curr Qty','Unrealised P&L','Realised P&L','Status']
              const rows = baseFiltered.map(t => {
                const mExs2 = mExecs.filter(e=>e.trade_id===t.id)
                const mSold = mExs2.reduce((s,e)=>s+Number(e.quantity),0)
                const mOrig = Number(t.quantity)||0
                const mCurr = Math.max(0,mOrig-mSold)
                const mEntry = Number(t.entry_price)||0
                const mLp = livePrices[t.ticker]?.price
                const mUnr = mLp&&mCurr>0?(t.direction==='LONG'?(mLp-mEntry)*mCurr:(mEntry-mLp)*mCurr):''
                const mRel = mExs2.length>0?mExs2.reduce((s,e)=>s+(Number(e.price)-mEntry)*Number(e.quantity),0):(Number(t.realized_gains)||0)
                return [t.ticker,t.direction,t.account||'',t.entry_date,mEntry,t.exit_price||'',mOrig,mCurr,mUnr!==''?mUnr.toFixed(2):'',mRel.toFixed(2),t.status]
              })
              const csv = [headers,...rows].map(r=>r.join(',')).join('\n')
              triggerCSVDownload(csv, `${mirrorInfo?.subscriber_name||'trades'}_trades.csv`)
            }} style={{ padding:'4px 12px', background:'var(--surface)', border:'1px solid var(--border)', color:'var(--muted)', borderRadius:'4px', cursor:'pointer', fontSize:'10px', fontFamily:'DM Mono, monospace' }}>
              ⬇ CSV
            </button>
          </div>
        </div>
        {mTrades.length === 0 ? (
          <div style={{ color:'var(--muted)', fontSize:'13px', padding:'20px' }}>No trades found.</div>
        ) : (
          <div style={{ border:'1px solid var(--border)', borderRadius:'8px', overflow:'hidden' }}>
            <table className="data-table">
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
                    <th key={col.key} className={col.right ? 'r' : undefined} style={{ cursor:'pointer' }}
                      onClick={() => mTf.handleSort(col.key)}>
                      <div className="col-header" style={col.right ? { justifyContent:'flex-end' } : undefined}>
                        <span>{col.label}</span>
                        <span className={`sort-arrow${mTf.sortConfig?.key===col.key?' active':''}`}>
                          {mTf.sortConfig?.key===col.key?(mTf.sortConfig.direction==='asc'?'↑':'↓'):'↕'}
                        </span>
                        {col.filterable && (
                          <span className={`filter-icon${(mTf.columnFilters[col.key]?.size||0)>0?' has-filter':''}`}
                            onClick={e => mTf.openFilter(e, col.key)}>▼</span>
                        )}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {mTf.filteredData.map(trade => {
                  const execs = mExecs.filter(e => e.trade_id === trade.id)
                  const totalSoldQty = execs.reduce((s,e) => s + Number(e.quantity), 0)
                  const originalQty = Number(trade.quantity) || 0
                  const currentQty = Math.max(0, originalQty - totalSoldQty)
                  const entryPrice = Number(trade.entry_price) || 0
                  const investment = Number(trade.invested_capital) || (entryPrice * originalQty)
                  const actualInv = Number(trade.actual_investment) || 0
                  const mtfBase = investment - actualInv
                  const lp = livePrices[trade.ticker]
                  const cmp = lp?.price
                  const realisedPnL = execs.length > 0 ? execs.reduce((s,e) => s + (Number(e.price) - entryPrice) * Number(e.quantity), 0) : (Number(trade.realized_gains) || 0)
                  const unrealisedPnL = cmp && currentQty > 0 ? (trade.direction==='LONG' ? (cmp-entryPrice)*currentQty : (entryPrice-cmp)*currentQty) : null
                  const mtfInt = mtfBase > 0 && trade.mtf_interest_rate && trade.entry_date
                    ? execs.reduce((s,e) => { const days = Math.max(1, Math.floor((new Date(e.date)-new Date(trade.entry_date))/86400000)); return s + mtfBase*(Number(e.quantity)/originalQty)*trade.mtf_interest_rate*days/36500 }, 0)
                      + (currentQty > 0 ? mtfBase*(currentQty/originalQty)*trade.mtf_interest_rate*Math.max(1,Math.floor((new Date()-new Date(trade.entry_date))/86400000))/36500 : 0)
                    : null
                  const exitPrice = currentQty===0 && execs.length>0 ? execs.reduce((s,e)=>s+Number(e.price)*Number(e.quantity),0)/totalSoldQty : trade.exit_price||null
                  return (
                    <tr key={trade.id}>
                      <td>
                        <div className="tk-cell">
                          <span className="tk-name">{trade.ticker}</span>
                          <div className="tk-badges">
                            <span className={trade.direction==='LONG'?'dir-long':'dir-short'}>{trade.direction}</span>
                          </div>
                        </div>
                      </td>
                      <td style={{ fontSize:'11px', color:'var(--muted)' }}>{trade.account||'—'}</td>
                      <td style={{ fontSize:'11px', color:'var(--muted)' }}>{trade.entry_date?.slice(0,10)}</td>
                      <td className="num">Rs.{toINRd(entryPrice)}</td>
                      <td className="num">{cmp ? <div className="sc"><span className="sc1">Rs.{toINRd(cmp)}</span><span className="sc2" style={{ color:lp.change>=0?'var(--bull)':'var(--bear)' }}>{lp.change>=0?'+':''}{lp.changePercent?.toFixed(2)}%</span></div> : <span style={{ color:'var(--muted)' }}>—</span>}</td>
                      <td className="num">{exitPrice ? `Rs.${toINRd(exitPrice)}` : <span style={{ color:'var(--muted)' }}>—</span>}</td>
                      <td className="num">
                        <div className="sc">
                          <span className="sc1">{toINR(originalQty)}</span>
                          <span className="sc2" style={{ color:currentQty===0?'var(--bear)':currentQty<originalQty?'var(--gold)':'var(--muted)' }}>{toINR(currentQty)}</span>
                        </div>
                      </td>
                      <td className="num">
                        {investment ? <div className="sc"><span className="sc1">Rs.{toINRd(investment)}</span><span className="sc2">{actualInv ? `Rs.${toINRd(actualInv)}` : '—'}</span></div> : <span style={{ color:'var(--muted)' }}>—</span>}
                      </td>
                      <td className="num">{mtfInt ? <span className="mtf-val">Rs.{toINRd(mtfInt)}</span> : <span style={{ color:'var(--muted)' }}>—</span>}</td>
                      <td className="num">{unrealisedPnL !== null ? <span className={unrealisedPnL>=0?'pnl-pos':'pnl-neg'}>{unrealisedPnL>=0?'+':'−'}Rs.{toINRd(Math.abs(unrealisedPnL))}</span> : <span style={{ color:'var(--muted)' }}>—</span>}</td>
                      <td className="num">{realisedPnL !== 0 || trade.status==='CLOSED' ? <span className={realisedPnL>=0?'pnl-pos':'pnl-neg'}>{realisedPnL>=0?'+':'−'}Rs.{toINRd(Math.abs(realisedPnL))}</span> : <span style={{ color:'var(--muted)' }}>—</span>}</td>
                      <td>{trade.status==='OPEN' ? <span className="st-open">OPEN</span> : <span className="st-closed">CLOSED</span>}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {mTf.openFilterKey && (
              <FilterDropdown
                position={mTf.filterDropPos}
                uniqueValues={mTf.getUniqueValues(mTf.openFilterKey)}
                hiddenValues={mTf.columnFilters[mTf.openFilterKey] || new Set()}
                onToggle={v => mTf.toggleFilterValue(mTf.openFilterKey, v)}
                onSelectAll={() => mTf.selectAllFilter(mTf.openFilterKey)}
                onDeselectAll={() => mTf.deselectAllFilter(mTf.openFilterKey, mTf.getUniqueValues(mTf.openFilterKey))}
                onClose={() => mTf.setOpenFilterKey(null)}
              />
            )}
          </div>
        )}
      </div>
      <AccountRightPanel
        trades={mTrades}
        executions={mExecsMap}
        livePrices={livePrices}
        selectedMonth={selectedMonth}
        setSelectedMonth={setSelectedMonth}
      />
    </div>
  )
}

function AccountRightPanel({ trades, executions, livePrices, selectedMonth, setSelectedMonth }) {
  const allYears = [...new Set(trades.map(t => t.entry_date?.slice(0,4)).filter(Boolean))].sort().reverse()
  const defaultYear = allYears[0] || String(new Date().getFullYear())
  const [panelYear, setPanelYear] = useState(defaultYear)

  const toINRd = n => Math.abs(Number(n)||0).toLocaleString('en-IN', { minimumFractionDigits:2, maximumFractionDigits:2 })

  let acUnrealised = 0, acRealised = 0, acOpen = 0, acClosed = 0, acMTF = 0
  trades.forEach(trade => {
    const exs = executions[trade.id] || []
    const totalSold = exs.reduce((s,e) => s + Number(e.quantity), 0)
    const origQty = Number(trade.quantity) || 0
    const currQty = Math.max(0, origQty - totalSold)
    const entry = Number(trade.entry_price) || 0
    const investment = Number(trade.invested_capital) || (entry * origQty)
    const actualInv = Number(trade.actual_investment) || 0
    const mtfBase = investment - actualInv

    if (currQty > 0) acOpen++; else acClosed++

    const lp = livePrices[trade.ticker]
    if (lp && currQty > 0) {
      acUnrealised += trade.direction === 'LONG' ? (lp.price - entry) * currQty : (entry - lp.price) * currQty
    }
    const realised = exs.length > 0
      ? exs.reduce((s,e) => s + (Number(e.price) - entry) * Number(e.quantity), 0)
      : (Number(trade.realized_gains) || 0)
    acRealised += realised

    if (mtfBase > 0 && trade.mtf_interest_rate && trade.entry_date) {
      const soldMtf = exs.reduce((s,e) => {
        const days = Math.max(1, Math.floor((new Date(e.date) - new Date(trade.entry_date)) / 86400000))
        return s + mtfBase * (Number(e.quantity)/origQty) * trade.mtf_interest_rate * days / 36500
      }, 0)
      const remDays = Math.max(1, Math.floor((new Date() - new Date(trade.entry_date)) / 86400000))
      const remMtf = currQty > 0 ? mtfBase * (currQty/origQty) * trade.mtf_interest_rate * remDays / 36500 : 0
      acMTF += soldMtf + remMtf
    }
  })

  const statCards = [
    { label:'Unrealised P&L', value:`${acUnrealised>=0?'+':'−'}Rs.${toINRd(Math.abs(acUnrealised))}`, color:acUnrealised>=0?'var(--bull)':'var(--bear)' },
    { label:'Realised P&L',   value:`${acRealised>=0?'+':'−'}Rs.${toINRd(Math.abs(acRealised))}`,   color:acRealised>=0?'var(--bull)':'var(--bear)' },
    { label:'MTF Interest',   value:`Rs.${toINRd(acMTF)}`, color:'var(--gold)' },
  ]

  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

  return (
    <div style={{ width:'160px', flexShrink:0, display:'flex', flexDirection:'column', gap:'8px' }}>
      {/* Month grid — top */}
      <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'8px', padding:'10px', marginTop:'2px' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'8px' }}>
          <button onClick={() => setPanelYear(y => String(Number(y)-1))} style={{ background:'none', border:'1px solid var(--border)', color:'var(--muted)', borderRadius:'4px', padding:'1px 7px', cursor:'pointer', fontSize:'11px' }}>‹</button>
          <span style={{ fontFamily:'DM Mono, monospace', fontWeight:700, fontSize:'11px', color:'var(--text)' }}>{panelYear}</span>
          <button onClick={() => setPanelYear(y => String(Number(y)+1))} style={{ background:'none', border:'1px solid var(--border)', color:'var(--muted)', borderRadius:'4px', padding:'1px 7px', cursor:'pointer', fontSize:'11px' }}>›</button>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'4px' }}>
          {months.map((mon, idx) => {
            const ym = `${panelYear}-${String(idx+1).padStart(2,'0')}`
            const count = trades.filter(t => t.entry_date?.slice(0,7) === ym).length
            const isSel = selectedMonth === ym
            const hasData = count > 0
            return (
              <button key={mon} onClick={() => hasData && setSelectedMonth(isSel ? null : ym)} style={{
                padding:'5px 2px', borderRadius:'5px', cursor:hasData?'pointer':'default',
                border:`1px solid ${isSel?'var(--accent)':hasData?'var(--border)':'transparent'}`,
                background:isSel?'var(--accent-dim)':'transparent',
                color:isSel?'var(--accent)':hasData?'var(--text)':'var(--muted)',
                fontFamily:'DM Mono, monospace', fontWeight:hasData?700:400,
                fontSize:'10px', opacity:hasData?1:0.35,
                display:'flex', flexDirection:'column', alignItems:'center', gap:'1px',
              }}>
                <span>{mon}</span>
                {hasData && <span style={{ fontSize:'8px', color:isSel?'var(--accent)':'var(--muted)' }}>{count}</span>}
              </button>
            )
          })}
        </div>
        {selectedMonth && (
          <button onClick={() => setSelectedMonth(null)} style={{ marginTop:'6px', width:'100%', padding:'4px', background:'none', border:'1px solid var(--border)', borderRadius:'4px', color:'var(--muted)', cursor:'pointer', fontSize:'9px', fontFamily:'DM Mono, monospace' }}>
            Clear Filter
          </button>
        )}
      </div>

      {/* Stat tiles — below calendar */}
      {statCards.map(s => (
        <div key={s.label} style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'8px', padding:'9px 12px' }}>
          <div style={{ fontSize:'8px', color:'var(--muted)', letterSpacing:'0.1em', textTransform:'uppercase', fontFamily:'DM Mono, monospace', marginBottom:'4px' }}>{s.label}</div>
          <div style={{ fontSize:'12px', fontWeight:700, fontFamily:'DM Mono, monospace', color:s.color||'var(--text)' }}>{s.value}</div>
        </div>
      ))}
    </div>
  )
}

export default function AccountsPage() {
  const router = useRouter()
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(false)
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
  const [activeMirrorAccount, setActiveMirrorAccount] = useState(null)
  const [mirrorFilter, setMirrorFilter] = useState('ALL')
  const [selectedMonth, setSelectedMonth] = useState(null) // 'YYYY-MM' or null=ALL
  const [shareModal, setShareModal] = useState(null) // account name being shared
  const [accountShares, setAccountShares] = useState([]) // { account_name, subscriber_id }[]
  const [subscribers, setSubscribers] = useState([]) // for share picker
  const [sharedAdminTrades, setSharedAdminTrades] = useState([]) // subscriber: admin trades for shared accounts
  const [sharedAdminExecs, setSharedAdminExecs] = useState([])
  const [activeShared, setActiveShared] = useState(null) // shared account name subscriber is viewing

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
    const t = token || (await supabase.auth.getSession()).data.session?.access_token
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

  const loadData = useCallback(async (silent = false) => {
    if (!session) return
    // Only show spinner on first load (no data yet), never on focus/tab-switch refresh
    if (!silent) setLoading(prev => trades.length === 0 ? true : prev)
    const [{ data: tData }, { data: aData }] = await Promise.all([
      supabase.from('trades').select('*').eq('user_id', session.user.id).order('entry_date', { ascending: false }),
      supabase.from('accounts').select('*').eq('user_id', session.user.id).order('name'),
    ])
    if (Array.isArray(tData)) {
      setTrades(tData)
      await fetchAllExecutions(tData)
    }
    if (Array.isArray(aData)) {
      setAccounts(aData)
      if (aData.length > 0) setActiveAccount(prev => prev || aData[0].name)
    }
    setLoading(false)
  }, [session]) // eslint-disable-line

  useEffect(() => { if (session) loadData() }, [session, loadData])

  // Refresh silently on tab focus — no spinner, always fresh
  useEffect(() => {
    const onFocus = () => { if (session) loadData(true) }
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [session, loadData])

  useEffect(() => {
    if (!session) return
    if (isAdmin) {
      loadMirroredAccounts()
      loadAccountShares()
      loadSubscribersForShare()
      const onFocus = () => loadMirroredAccounts()
      window.addEventListener('focus', onFocus)
      return () => window.removeEventListener('focus', onFocus)
    } else {
      loadSharedAdminAccounts()
    }
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
    if (!session) return
    // Fetch prices for own trades
    const ownSymbols = [...new Set(trades.filter(t => t.status==='OPEN').map(t => t.ticker))]
    // Also fetch for shared admin trades
    const sharedSymbols = [...new Set(sharedAdminTrades.filter(t => t.status==='OPEN').map(t => t.ticker))]
    const allSymbols = [...new Set([...ownSymbols, ...sharedSymbols])]
    allSymbols.forEach(fetchPrice)
  }, [trades, sharedAdminTrades, session]) // eslint-disable-line

  useEffect(() => {
    if (countdown===60 && session && trades.length) {
      const symbols = [...new Set(trades.filter(t => t.status==='OPEN').map(t => t.ticker))]
      symbols.forEach(fetchPrice)
    }
  }, [countdown]) // eslint-disable-line

  const fetchExecutions = async (tradeId) => {
    const { data } = await supabase.from('executions').select('*').eq('trade_id', tradeId).eq('user_id', session.user.id).order('date', { ascending: true })
    if (Array.isArray(data)) setExecutions(prev => ({ ...prev, [tradeId]: data }))
  }

  const fetchAllExecutions = async (tradeList) => {
    if (!tradeList.length) { setExecutions({}); return }
    const tradeIds = tradeList.map(t => t.id)
    const { data } = await supabase.from('executions').select('*').in('trade_id', tradeIds).eq('user_id', session.user.id).order('date', { ascending: true })
    const map = {}
    tradeList.forEach(t => { map[t.id] = [] })
    ;(data || []).forEach(e => { if (map[e.trade_id] !== undefined) map[e.trade_id].push(e) })
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
    const res = await fetch('/api/trades', { method:'POST', headers:{ 'Content-Type':'application/json', Authorization:`Bearer ${token}` }, body:JSON.stringify({ ...tradeData, account: tradeData.account || activeAccount }) })
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
    if (!confirm('🗑 Delete this trade?\n\nThis will also remove all execution history for this trade.')) return
    if (!confirm('⚠️ CONFIRM DELETE\n\nAre you absolutely sure? This cannot be undone.')) return
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
    if (!confirm(`🗑 Delete account "${acc.name}"?\n\nThis will permanently delete ALL trades and execution history in this account.`)) return
    if (!confirm(`⚠️ CONFIRM DELETE\n\nAccount: ${acc.name}\n\nAre you absolutely sure? This cannot be undone.`)) return
    const token = await getToken()
    await fetch('/api/accounts', { method:'DELETE', headers:{ 'Content-Type':'application/json', Authorization:`Bearer ${token}` }, body:JSON.stringify({ id:acc.id, name:acc.name }) })
    setActiveAccount(accounts.find(a => a.name !== acc.name)?.name || null)
    await loadData()
  }

  // Load account shares (admin)
  const loadAccountShares = async () => {
    const token = await getToken()
    const res = await fetch('/api/account-shares', { headers:{ Authorization:`Bearer ${token}` } })
    const data = await res.json()
    if (Array.isArray(data)) setAccountShares(data)
  }

  // Load subscriber list for share picker (admin)
  const loadSubscribersForShare = async () => {
    const token = await getToken()
    const res = await fetch('/api/admin/subscribers', { headers:{ Authorization:`Bearer ${token}` } })
    const data = await res.json()
    if (Array.isArray(data)) setSubscribers(data.filter(s => s.email !== 'gogoaheadgo@gmail.com'))
  }

  // Share/unshare account with subscriber (admin)
  const handleShareAccount = async (accountName, subscriberId, isCurrentlyShared) => {
    const token = await getToken()
    if (isCurrentlyShared) {
      await fetch('/api/account-shares', { method:'DELETE', headers:{'Content-Type':'application/json', Authorization:`Bearer ${token}`}, body: JSON.stringify({ subscriber_id: subscriberId, account_name: accountName }) })
    } else {
      await fetch('/api/account-shares', { method:'POST', headers:{'Content-Type':'application/json', Authorization:`Bearer ${token}`}, body: JSON.stringify({ subscriber_id: subscriberId, account_name: accountName }) })
    }
    await loadAccountShares()
  }

  // Load admin's shared accounts for subscriber
  const loadSharedAdminAccounts = async () => {
    const token = await getToken()
    if (!token) return
    // Single dedicated endpoint — handles auth + filtering server-side
    const res = await fetch('/api/shared-account-trades', { headers:{ Authorization:`Bearer ${token}` } })
    const data = await res.json()
    if (data.error) { console.error('loadSharedAdminAccounts:', data.error); return }
    setSharedAdminTrades(data.trades || [])
    setSharedAdminExecs(data.executions || [])
  }

  const downloadCSV = (tradeList, filename) => {
    const headers = ['Ticker','Direction','Account','Entry Date','Entry Price','Exit Price','Qty','Curr Qty','Investment','Actual Inv','MTF Rate%','MTF Accrued','Unrealised P&L','Realised P&L','Status']
    const rows = tradeList.map(t => {
      const exs = executions[t.id] || []
      const totalSold = exs.reduce((s,e) => s+Number(e.quantity), 0)
      const origQty = Number(t.quantity) || 0
      const currQty = Math.max(0, origQty - totalSold)
      const entry = Number(t.entry_price) || 0
      const investment = Number(t.invested_capital) || (entry * origQty)
      const actualInv = Number(t.actual_investment) || 0
      const mtfBase = investment - actualInv
      const lp = livePrices[t.ticker]?.price
      const unrealised = lp && currQty > 0 ? (t.direction==='LONG'?(lp-entry)*currQty:(entry-lp)*currQty) : ''
      const realised = exs.length > 0 ? exs.reduce((s,e)=>s+(Number(e.price)-entry)*Number(e.quantity),0) : (Number(t.realized_gains)||0)
      let mtfAccrued = ''
      if (mtfBase > 0 && t.mtf_interest_rate && t.entry_date) {
        const soldM = exs.reduce((s,e)=>{ const d=Math.max(1,Math.floor((new Date(e.date)-new Date(t.entry_date))/86400000)); return s+mtfBase*(Number(e.quantity)/origQty)*t.mtf_interest_rate*d/36500 },0)
        const remD = Math.max(1,Math.floor((new Date()-new Date(t.entry_date))/86400000))
        const remM = currQty>0 ? mtfBase*(currQty/origQty)*t.mtf_interest_rate*remD/36500 : 0
        mtfAccrued = (soldM+remM).toFixed(2)
      }
      return [t.ticker,t.direction,t.account||'',t.entry_date,entry,t.exit_price||'',origQty,currQty,investment||'',actualInv||'',t.mtf_interest_rate||'',mtfAccrued,unrealised!==''?unrealised.toFixed(2):'',realised.toFixed(2),t.status]
    })
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n')
    triggerCSVDownload(csv, filename)
  }

  const signOut = async () => { await supabase.auth.signOut(); window.location.href = '/' }

  const handleDeleteMyAccount = async () => {
    if (isAdmin) return
    const confirmed = window.confirm('🗑 DELETE YOUR ACCOUNT?\n\nThis will permanently erase:\n• All your trades\n• All accounts\n• All execution history\n• All notes and alerts\n\nThis CANNOT be undone.')
    if (!confirmed) return
    if (!window.confirm('⚠️ FINAL CONFIRMATION\n\nYou are about to permanently delete your entire account.\n\nAre you absolutely sure?')) return
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
  const hasMirrored = allMirroredTrades.length > 0 || sharedAdminTrades.length > 0
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

  // Also include shared admin trades for subscribers
  const totalRealised = calcRealised(trades, allOwnExecs) + calcRealised(allMirroredTrades, allMirroredExecs) + calcRealised(sharedAdminTrades, sharedAdminExecs)
  const totalMTF = calcMTF(trades) + calcMTF(allMirroredTrades) + calcMTF(sharedAdminTrades)
  const totalOpen = trades.filter(t=>t.status==='OPEN').length + allMirroredTrades.filter(t=>t.status==='OPEN').length + sharedAdminTrades.filter(t=>t.status==='OPEN').length
  const totalClosed = trades.filter(t=>t.status==='CLOSED').length + allMirroredTrades.filter(t=>t.status==='CLOSED').length + sharedAdminTrades.filter(t=>t.status==='CLOSED').length

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

  const totalUnrealised = calcUnrealised(trades, allOwnExecs) + calcUnrealised(allMirroredTrades, allMirroredExecs) + calcUnrealised(sharedAdminTrades, sharedAdminExecs)

  const mainColumns = useMemo(() => [
    { key: 'ticker', filterable: true, sortable: true },
    { key: 'direction', filterable: true, sortable: true },
    { key: 'entry_date', sortable: true },
    { key: 'entry_price', sortable: true, getSortValue: t => Number(t.entry_price) || 0 },
    { key: 'cmp', sortable: true, getSortValue: t => livePrices[t.ticker]?.price || 0 },
    { key: 'exit_price', sortable: true, getSortValue: t => Number(t.exit_price) || 0 },
    { key: 'quantity', sortable: true, getSortValue: t => Number(t.quantity) || 0 },
    { key: 'invested_capital', sortable: true, getSortValue: t => Number(t.invested_capital) || 0 },
    { key: 'mtf_int', sortable: true, getSortValue: t => {
      const exs = executions[t.id] || []
      const orig = Number(t.quantity) || 0
      const curr = Math.max(0, orig - exs.reduce((s,e) => s+Number(e.quantity), 0))
      const inv = Number(t.invested_capital) || (Number(t.entry_price)*orig)
      const base = inv - (Number(t.actual_investment)||0)
      if (!base || !t.mtf_interest_rate || !t.entry_date) return 0
      return base*(curr/orig)*t.mtf_interest_rate*Math.max(1,Math.floor((new Date()-new Date(t.entry_date))/86400000))/36500
    }},
    { key: 'unrealised', sortable: true, getSortValue: t => {
      const exs = executions[t.id] || []
      const orig = Number(t.quantity) || 0
      const curr = Math.max(0, orig - exs.reduce((s,e) => s+Number(e.quantity), 0))
      const entry = Number(t.entry_price) || 0
      const lp = livePrices[t.ticker]?.price
      if (!lp || curr === 0) return -Infinity
      return t.direction === 'LONG' ? (lp-entry)*curr : (entry-lp)*curr
    }},
    { key: 'realised', sortable: true, getSortValue: t => {
      const exs = executions[t.id] || []
      const entry = Number(t.entry_price) || 0
      return exs.length > 0 ? exs.reduce((s,e) => s+(Number(e.price)-entry)*Number(e.quantity), 0) : (Number(t.realized_gains)||0)
    }},
  ], [livePrices, executions])

  const monthFilteredForHook = useMemo(() =>
    selectedMonth
      ? filtered.filter(t => t.entry_date && t.entry_date.slice(0,7) === selectedMonth)
      : filtered,
    [filtered, selectedMonth])

  const mainTf = useTableFilter(monthFilteredForHook, mainColumns)

  if (!session) return null

  // Pre-compute mirrored execs map for right panel (no IIFE in JSX)
  const activeMirrorExecsMap = (() => {
    if (!activeMirror) return {}
    const mExecs = mirroredExecs[activeMirror] || []
    return mExecs.reduce((m, e) => { if (!m[e.trade_id]) m[e.trade_id] = []; m[e.trade_id].push(e); return m }, {})
  })()
  const activeMirrorAllTrades = activeMirror ? (mirroredTrades[activeMirror] || []) : []
  const activeMirrorTrades = activeMirrorAccount
    ? activeMirrorAllTrades.filter(t => t.account === activeMirrorAccount)
    : activeMirrorAllTrades

  return (
    <>
      <div className="tricolor-bar" />
      <Head><title>Accounts — SMK Stock Journal</title></Head>
      <Sidebar active="Accounts" isAdmin={isAdmin} user={session?.user} onSignOut={signOut} onDeleteAccount={!isAdmin ? handleDeleteMyAccount : undefined} />

      <main className="sidebar-offset" style={{ padding:'28px 32px 40px' }}>

        <div style={{ display:'flex', justifyContent:'flex-end', gap:'8px', marginBottom:'16px', alignItems:'center' }}>
          <button onClick={() => { loadData(); if(isAdmin) loadMirroredAccounts() }}
            style={{ background:'none', border:'1px solid var(--border)', borderRadius:'4px', color:'var(--muted)', cursor:'pointer', fontSize:'11px', padding:'4px 10px', fontFamily:'DM Mono, monospace' }}>
            ↻ {openTrades.length > 0 ? `${countdown}s` : 'Refresh'}
          </button>
          <button onClick={() => setShowAdd(true)} className="btn btn-primary" style={{ padding:'6px 14px', fontSize:'11px' }}>+ New Trade</button>
        </div>

        {/* ── AGGREGATE STATS (always visible) ── */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(150px,1fr))', gap:'10px', marginBottom:'20px' }}>
          {[
            { label:'Unrealised P&L', value:`${totalUnrealised>=0?'+':'−'}Rs.${toINRd(Math.abs(totalUnrealised))}`, color:totalUnrealised>=0?'var(--bull)':'var(--bear)' },
            { label:'Realised P&L', value:`${totalRealised>=0?'+':'−'}Rs.${toINRd(Math.abs(totalRealised))}`, color:totalRealised>=0?'var(--bull)':'var(--bear)' },
            { label:'Open Positions', value:totalOpen, color:'var(--accent)' },
            { label:'Closed Trades', value:totalClosed },
            { label:'MTF Interest', value:`Rs.${toINRd(totalMTF)}`, color:'var(--gold)' },
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
                {isAdmin && (
                  <button onClick={e => { e.stopPropagation(); setShareModal(acc.name) }}
                    style={{ flex:1, padding:'6px', background:'none', border:'none', borderRight:'1px solid var(--border)',
                      color: accountShares.some(s => s.account_name === acc.name) ? 'var(--bull)' : 'var(--muted)',
                      cursor:'pointer', fontSize:'12px' }} title="Share with subscriber">🔗</button>
                )}
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
          {/* Shared Admin Account Tiles (subscriber view) */}
          {!isAdmin && sharedAdminTrades.length > 0 && [...new Set(sharedAdminTrades.map(t => t.account))].map(accName => (
            <div key={accName}
              onClick={() => setActiveShared(prev => prev === accName ? null : accName)}
              style={{ border:`2px solid ${activeShared===accName?'var(--accent)':'rgba(14,165,233,0.3)'}`, background:activeShared===accName?'var(--accent-dim)':'rgba(14,165,233,0.05)', borderRadius:'10px', minWidth:'120px', cursor:'pointer', padding:'14px 16px 10px' }}>
              <div style={{ fontSize:'14px', fontWeight:700, fontFamily:'DM Mono, monospace', color:activeShared===accName?'var(--accent)':'var(--text)' }}>{accName}</div>
              <div style={{ fontSize:'9px', color:'var(--accent)', marginTop:'3px', fontFamily:'DM Mono, monospace', opacity:0.8 }}>
                🔗 SHARED · {sharedAdminTrades.filter(t=>t.account===accName).length} trades
              </div>
            </div>
          ))}

          {/* Mirrored Account Tiles */}
          {mirroredAccounts.map(m => (
            <div key={m.subscriber_id}
              onClick={() => { setActiveMirror(prev => prev===m.subscriber_id ? null : m.subscriber_id); setMirrorFilter('ALL'); setActiveMirrorAccount(null) }}
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
          <>
            {/* Sub-account tiles for this mirrored subscriber */}
            {(() => {
              const mirrorSubAccts = [...new Set(activeMirrorAllTrades.map(t => t.account).filter(Boolean))]
              if (mirrorSubAccts.length <= 1) return null
              return (
                <div style={{ display:'flex', gap:'10px', flexWrap:'wrap', marginBottom:'16px', alignItems:'center' }}>
                  <div style={{ fontSize:'10px', color:'var(--muted)', fontFamily:'DM Mono, monospace', letterSpacing:'0.1em', marginRight:'4px' }}>SUB-ACCOUNTS:</div>
                  {/* All accounts tile */}
                  <button onClick={() => { setActiveMirrorAccount(null); setMirrorFilter('ALL') }} style={{
                    padding:'6px 16px', borderRadius:'6px', cursor:'pointer', fontSize:'11px',
                    fontFamily:'DM Mono, monospace', fontWeight:600,
                    border:`2px solid ${!activeMirrorAccount ? 'var(--gold)' : 'var(--border)'}`,
                    background: !activeMirrorAccount ? 'rgba(245,158,11,0.1)' : 'var(--surface)',
                    color: !activeMirrorAccount ? 'var(--gold)' : 'var(--muted)',
                  }}>
                    All ({activeMirrorAllTrades.length} trades)
                  </button>
                  {mirrorSubAccts.map(acctName => {
                    const acctTrades = activeMirrorAllTrades.filter(t => t.account === acctName)
                    const acctOpen   = acctTrades.filter(t => t.status === 'OPEN').length
                    const isActive   = activeMirrorAccount === acctName
                    return (
                      <button key={acctName} onClick={() => { setActiveMirrorAccount(acctName); setMirrorFilter('ALL') }} style={{
                        padding:'6px 16px', borderRadius:'6px', cursor:'pointer', fontSize:'11px',
                        fontFamily:'DM Mono, monospace', fontWeight:600,
                        border:`2px solid ${isActive ? 'var(--gold)' : 'var(--border)'}`,
                        background: isActive ? 'rgba(245,158,11,0.1)' : 'var(--surface)',
                        color: isActive ? 'var(--gold)' : 'var(--muted)',
                      }}>
                        {acctName}
                        <span style={{ marginLeft:'6px', fontSize:'9px', opacity:0.8 }}>
                          {acctOpen > 0 ? `${acctOpen} open` : `${acctTrades.length} trades`}
                        </span>
                      </button>
                    )
                  })}
                </div>
              )
            })()}
          <MirroredView
            mirrorInfo={mirroredAccounts.find(m => m.subscriber_id === activeMirror)}
            mTrades={activeMirrorTrades}
            mExecs={mirroredExecs[activeMirror]||[]}
            mExecsMap={activeMirrorExecsMap}
            mirrorFilter={mirrorFilter}
            setMirrorFilter={setMirrorFilter}
            livePrices={livePrices}
            toINRd={toINRd}
            toINR={toINR}
            loadMirroredTrades={loadMirroredTrades}
            activeMirror={activeMirror}
            selectedMonth={selectedMonth}
            setSelectedMonth={setSelectedMonth}
          />
          </>
        ) : activeShared ? (
          // Subscriber viewing a shared admin account
          <div style={{ display:'flex', gap:'16px', alignItems:'flex-start' }}>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'14px' }}>
                <span style={{ fontSize:'13px', fontWeight:700, color:'var(--accent)', fontFamily:'DM Mono, monospace' }}>🔗 {activeShared} (Shared by Admin)</span>
                <span style={{ fontSize:'10px', background:'var(--accent-dim)', color:'var(--accent)', padding:'2px 8px', borderRadius:'4px', fontFamily:'DM Mono, monospace' }}>READ ONLY · LIVE SYNC</span>
              </div>
              {(() => {
                const accTrades = sharedAdminTrades.filter(t => t.account === activeShared)
                const accExecsMap = sharedAdminExecs.reduce((m,e) => { if (!m[e.trade_id]) m[e.trade_id]=[]; m[e.trade_id].push(e); return m }, {})
                return (
                  <MirroredView
                    mirrorInfo={{ subscriber_name: activeShared }}
                    mTrades={accTrades}
                    mExecs={sharedAdminExecs.filter(e => accTrades.some(t => t.id === e.trade_id))}
                    mExecsMap={accExecsMap}
                    mirrorFilter={mirrorFilter}
                    setMirrorFilter={setMirrorFilter}
                    livePrices={livePrices}
                    toINRd={toINRd}
                    toINR={toINR}
                    loadMirroredTrades={() => loadSharedAdminAccounts()}
                    activeMirror={activeShared}
                    selectedMonth={selectedMonth}
                    setSelectedMonth={setSelectedMonth}
                  />
                )
              })()}
            </div>
          </div>
        ) : !activeAccount ? (
          <div style={{ textAlign:'center', padding:'80px', color:'var(--muted)' }}>No accounts yet.</div>
        ) : (
          <>
            {/* ── TWO COLUMN LAYOUT: left=trades, right=panel ── */}
            <div style={{ display:'flex', gap:'16px', alignItems:'flex-start' }}>
              {/* LEFT — filters + table */}
              <div style={{ flex:1, minWidth:0 }}>
                {/* Filter + month label */}
                <div style={{ display:'flex', gap:'6px', marginBottom:'14px', alignItems:'center', flexWrap:'wrap' }}>
                  {['ALL','OPEN','CLOSED'].map(f => (
                    <button key={f} onClick={() => setFilter(f)} style={{ padding:'5px 14px', borderRadius:'4px', border:`1px solid ${filter===f?'var(--accent)':'var(--border)'}`, background:filter===f?'var(--accent-dim)':'transparent', color:filter===f?'var(--accent)':'var(--muted)', cursor:'pointer', fontSize:'10px', fontFamily:'DM Mono, monospace', fontWeight:600 }}>
                      {f} ({f==='ALL'?accountTrades.length:f==='OPEN'?openTrades.length:closedTrades.length})
                    </button>
                  ))}
                  {selectedMonth && (
                    <span style={{ marginLeft:'6px', fontSize:'10px', fontFamily:'DM Mono, monospace', color:'var(--accent)', background:'var(--accent-dim)', padding:'3px 10px', borderRadius:'4px', display:'flex', alignItems:'center', gap:'6px' }}>
                      {new Date(selectedMonth+'-01').toLocaleString('default',{month:'long',year:'numeric'})}
                      <button onClick={() => setSelectedMonth(null)} style={{ background:'none', border:'none', color:'var(--accent)', cursor:'pointer', fontSize:'13px', padding:0, lineHeight:1 }}>×</button>
                    </span>
                  )}
                  <button onClick={() => {
                    const toDownload = selectedMonth ? filtered.filter(t => t.entry_date && t.entry_date.slice(0,7) === selectedMonth) : filtered
                    downloadCSV(toDownload, `${activeAccount}_trades.csv`)
                  }} style={{ marginLeft:'auto', padding:'5px 12px', background:'var(--surface)', border:'1px solid var(--border)', color:'var(--muted)', borderRadius:'4px', cursor:'pointer', fontSize:'10px', fontFamily:'DM Mono, monospace' }}>
                    ⬇ CSV
                  </button>
                </div>

            {monthFilteredForHook.length === 0 ? (
              <div style={{ textAlign:'center', padding:'60px', color:'var(--muted)', border:'1px dashed var(--border)', borderRadius:'8px' }}>
  <div style={{ marginBottom:'14px' }}>{selectedMonth ? 'No trades in this month.' : 'No trades yet.'}</div>
  {!selectedMonth && <button onClick={() => setShowAdd(true)} className="btn btn-primary" style={{ padding:'8px 20px', fontSize:'12px' }}>+ New Trade</button>}
</div>
            ) : (
              <div style={{ border:'1px solid var(--border)', borderRadius:'8px', overflow:'hidden' }}>
                <table className="data-table">
                  <colgroup>
                    <col style={{ width:'13%' }} />
                    <col style={{ width:'9%' }} />
                    <col style={{ width:'8%' }} />
                    <col style={{ width:'10%' }} />
                    <col style={{ width:'8%' }} />
                    <col style={{ width:'8%' }} />
                    <col style={{ width:'12%' }} />
                    <col style={{ width:'8%' }} />
                    <col style={{ width:'10%' }} />
                    <col style={{ width:'10%' }} />
                    <col style={{ width:'4%' }} />
                  </colgroup>
                  <thead>
                    <tr>
                      {[
                        { key:'ticker', label:'Ticker / Dir', filterable:true },
                        { key:'entry_date', label:'Entry Date' },
                        { key:'entry_price', label:'Entry Rs.', right:true },
                        { key:'cmp', label:'CMP', right:true },
                        { key:'exit_price', label:'Exit Rs.', right:true },
                        { key:'quantity', label:'Qty / Curr', right:true },
                        { key:'invested_capital', label:'Inv / Actual', right:true },
                        { key:'mtf_int', label:'MTF Int', right:true },
                        { key:'unrealised', label:'Unreal. P&L', right:true },
                        { key:'realised', label:'Real. P&L', right:true },
                      ].map(col => (
                        <th key={col.key} className={col.right ? 'r' : undefined} style={{ cursor:'pointer' }}
                          onClick={() => mainTf.handleSort(col.key)}>
                          <div className="col-header" style={col.right ? { justifyContent:'flex-end' } : undefined}>
                            <span>{col.label}</span>
                            <span className={`sort-arrow${mainTf.sortConfig?.key===col.key?' active':''}`}>
                              {mainTf.sortConfig?.key===col.key?(mainTf.sortConfig.direction==='asc'?'↑':'↓'):'↕'}
                            </span>
                            {col.filterable && (
                              <span className={`filter-icon${(mainTf.columnFilters[col.key]?.size||0)>0?' has-filter':''}`}
                                onClick={e => mainTf.openFilter(e, col.key)}>▼</span>
                            )}
                          </div>
                        </th>
                      ))}
                      <th style={{ cursor:'default' }}>Act</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr style={{ background:'var(--accent)', cursor:'pointer' }} onClick={() => setShowAdd(true)}>
                      <td colSpan={11} style={{ padding:'10px', textAlign:'center', borderBottom:'1px solid rgba(255,255,255,0.15)' }}>
                        <span style={{ color:'#000', fontSize:'12px', fontFamily:'DM Mono, monospace', fontWeight:700, letterSpacing:'0.08em' }}>+ New Trade</span>
                      </td>
                    </tr>
                    {mainTf.filteredData.map(trade => {
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
                            <td>
                              <div className="tk-cell">
                                <span className="tk-name">{trade.ticker}</span>
                                <div className="tk-badges">
                                  <span className={trade.direction==='LONG'?'dir-long':'dir-short'}>{trade.direction}</span>
                                  {isOpen ? <span className="st-open">OPEN</span> : <span className="st-closed">CLOSED</span>}
                                </div>
                              </div>
                            </td>
                            <td style={{ fontSize:'11px', color:'var(--muted)' }}>{trade.entry_date?.slice(0,10)}</td>
                            <td className="num">Rs.{toINRd(entryPrice)}</td>
                            <td className="num">
                              {isOpen && lp ? <div className="sc"><span className="sc1">Rs.{toINRd(lp.price)}</span><span className="sc2" style={{ color:lp.change>=0?'var(--bull)':'var(--bear)' }}>{lp.change>=0?'+':''}{lp.changePercent?.toFixed(2)}%</span></div> : <span style={{ color:'var(--muted)' }}>—</span>}
                            </td>
                            <td className="num">{exitPrice ? `Rs.${toINRd(exitPrice)}` : <span style={{ color:'var(--muted)' }}>—</span>}</td>
                            <td className="num">
                              <div className="sc">
                                <span className="sc1">{toINR(originalQty)}</span>
                                <span className="sc2" style={{ color:currentQty===0?'var(--bear)':currentQty<originalQty?'var(--gold)':'var(--muted)' }}>{toINR(currentQty)}</span>
                              </div>
                            </td>
                            <td className="num">
                              {investment ? <div className="sc"><span className="sc1">Rs.{toINRd(investment)}</span><span className="sc2">{actualInv ? `Rs.${toINRd(actualInv)}` : '—'}</span></div> : <span style={{ color:'var(--muted)' }}>—</span>}
                            </td>
                            <td className="num">{mtfInt ? <span className="mtf-val">Rs.{toINRd(mtfInt)}</span> : <span style={{ color:'var(--muted)' }}>—</span>}</td>
                            <td className="num">{unrealisedPnL !== null ? <span className={unrealisedPnL>=0?'pnl-pos':'pnl-neg'}>{unrealisedPnL>=0?'+':'−'}Rs.{toINRd(Math.abs(unrealisedPnL))}</span> : <span style={{ color:'var(--muted)' }}>—</span>}</td>
                            <td className="num">{realisedPnL !== 0 || trade.status==='CLOSED' ? <span className={realisedPnL>=0?'pnl-pos':'pnl-neg'}>{realisedPnL>=0?'+':'−'}Rs.{toINRd(Math.abs(realisedPnL))}</span> : <span style={{ color:'var(--muted)' }}>—</span>}</td>
                            <td style={{ textAlign:'center', position:'relative', overflow:'visible' }} onClick={e => e.stopPropagation()}>
                              <button onClick={e => { e.preventDefault(); e.stopPropagation(); setOpenMenu(prev => prev===trade.id ? null : trade.id) }} style={{ background:'none', border:'1px solid var(--border)', borderRadius:'4px', padding:'4px 10px', cursor:'pointer', color:'var(--muted)', fontSize:'14px', letterSpacing:'2px' }}>···</button>
                              {openMenu === trade.id && (
                                <div onClick={e => e.stopPropagation()} style={{ position:'absolute', right:0, bottom:'calc(100% + 4px)', zIndex:100, background:'var(--bg)', border:'1px solid var(--border)', borderRadius:'8px', boxShadow:'0 -4px 24px rgba(0,0,0,0.15)', minWidth:'130px', padding:'4px' }}>
                                  <button onClick={() => { setEditingTrade(trade); setOpenMenu(null) }} style={{ display:'block', width:'100%', padding:'8px 12px', background:'none', border:'none', textAlign:'left', cursor:'pointer', fontSize:'12px', color:'var(--text)', borderRadius:'5px', fontFamily:'DM Mono, monospace' }}>✏️ Edit</button>
                                  <button onClick={() => { handleDelete(trade.id); setOpenMenu(null) }} style={{ display:'block', width:'100%', padding:'8px 12px', background:'none', border:'none', textAlign:'left', cursor:'pointer', fontSize:'12px', color:'var(--bear)', borderRadius:'5px', fontFamily:'DM Mono, monospace' }}>🗑 Delete</button>
                                </div>
                              )}
                            </td>
                          </tr>
                          {expandedTrade === trade.id && (
                            <tr key={`exec-${trade.id}`}>
                              <td colSpan={11} style={{ padding:0, background:'var(--surface)', borderBottom:'2px solid var(--accent)' }}>
                                <ExecutionPanel trade={trade} executions={executions[trade.id]||[]} onAdd={(exec) => addExecution(trade.id, exec)} onDelete={(execId) => deleteExecution(execId, trade.id)} onAutoClose={(updates) => handleAutoClose(trade.id, updates)} />
                              </td>
                            </tr>
                          )}
                        </>
                      )
                    })}
                  </tbody>
                </table>
                {mainTf.openFilterKey && (
                  <FilterDropdown
                    position={mainTf.filterDropPos}
                    uniqueValues={mainTf.getUniqueValues(mainTf.openFilterKey)}
                    hiddenValues={mainTf.columnFilters[mainTf.openFilterKey] || new Set()}
                    onToggle={v => mainTf.toggleFilterValue(mainTf.openFilterKey, v)}
                    onSelectAll={() => mainTf.selectAllFilter(mainTf.openFilterKey)}
                    onDeselectAll={() => mainTf.deselectAllFilter(mainTf.openFilterKey, mainTf.getUniqueValues(mainTf.openFilterKey))}
                    onClose={() => mainTf.setOpenFilterKey(null)}
                  />
                )}
              </div>
            ) }
              </div>{/* end left column */}

              {/* RIGHT PANEL */}
              <AccountRightPanel
                trades={trades.filter(t => t.account === activeAccount)}
                executions={executions}
                livePrices={livePrices}
                selectedMonth={selectedMonth}
                setSelectedMonth={setSelectedMonth}
              />
            </div>{/* end two-col layout */}
          </>
        )}
      </main>

      {/* Share Account Modal */}
      {shareModal && isAdmin && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center' }}>
          <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'14px', padding:'26px', width:'360px', boxShadow:'0 24px 64px rgba(0,0,0,0.5)' }}>
            <div style={{ fontFamily:'Bookman Old Style, serif', fontWeight:700, fontSize:'16px', color:'var(--text)', marginBottom:'6px' }}>🔗 Share Account</div>
            <div style={{ fontSize:'12px', color:'var(--muted)', fontFamily:'DM Mono, monospace', marginBottom:'18px' }}>
              Account: <span style={{ color:'var(--accent)', fontWeight:700 }}>{shareModal}</span>
            </div>
            {subscribers.length === 0 ? (
              <div style={{ color:'var(--muted)', fontSize:'12px', fontFamily:'DM Mono, monospace' }}>No subscribers found.</div>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:'8px', maxHeight:'280px', overflowY:'auto' }}>
                {subscribers.map(sub => {
                  const isShared = accountShares.some(s => s.account_name === shareModal && s.subscriber_id === sub.id)
                  return (
                    <div key={sub.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 14px', background:'var(--bg)', border:`1px solid ${isShared?'var(--bull)':'var(--border)'}`, borderRadius:'8px' }}>
                      <div>
                        <div style={{ fontFamily:'DM Mono, monospace', fontWeight:700, fontSize:'13px', color:'var(--text)' }}>{sub.full_name || sub.email?.split('@')[0]}</div>
                        <div style={{ fontSize:'10px', color:'var(--muted)', marginTop:'2px' }}>{sub.email}</div>
                      </div>
                      <button onClick={() => handleShareAccount(shareModal, sub.id, isShared)} style={{
                        padding:'6px 14px', border:`1px solid ${isShared?'var(--bear)':'var(--bull)'}`,
                        background: isShared?'rgba(239,68,68,0.08)':'rgba(0,230,118,0.08)',
                        color: isShared?'var(--bear)':'var(--bull)',
                        borderRadius:'6px', cursor:'pointer', fontSize:'11px', fontFamily:'DM Mono, monospace', fontWeight:700
                      }}>
                        {isShared ? '✕ Unshare' : '✓ Share'}
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
            <button onClick={() => setShareModal(null)} style={{ marginTop:'18px', width:'100%', padding:'10px', background:'none', border:'1px solid var(--border)', color:'var(--muted)', borderRadius:'8px', cursor:'pointer', fontFamily:'DM Mono, monospace', fontSize:'12px' }}>Close</button>
          </div>
        </div>
      )}

      {showAdd && <AddTradeModal session={session} onClose={() => setShowAdd(false)} onAdd={handleAddTrade} isAdmin={isAdmin} activeAccount={activeAccount} />}
      {editingTrade && <EditTradeModal trade={editingTrade} onClose={() => setEditingTrade(null)} onSave={handleEdit} session={session} isAdmin={isAdmin} />}
    </>
  )
}
