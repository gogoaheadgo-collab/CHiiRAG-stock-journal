import React, { useState, useEffect, useCallback } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'
import { supabase } from '../lib/supabase'
import { differenceInDays } from 'date-fns'
import AddTradeModal from '../components/AddTradeModal'
import EditTradeModal from '../components/EditTradeModal'
import ExecutionPanel from '../components/ExecutionPanel'
import NavPill from '../components/NavPill'

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
  const [mSortCol, setMSortCol] = React.useState(null)
  const [mSortDir, setMSortDir] = React.useState('asc')
  const mDoSort = (col) => { if(mSortCol===col) setMSortDir(d=>d==='asc'?'desc':'asc'); else { setMSortCol(col); setMSortDir('asc') } }
  const mSortIcon = (col) => mSortCol===col ? (mSortDir==='asc'?' ↑':' ↓') : ' ↕'

  const mComputeVal = (trade, col) => {
    const mExs = mExecs.filter(e => e.trade_id === trade.id)
    const mTotalSold = mExs.reduce((s,e) => s+Number(e.quantity), 0)
    const mOrigQty = Number(trade.quantity) || 0
    const mCurrQty = Math.max(0, mOrigQty - mTotalSold)
    const mEntry = Number(trade.entry_price) || 0
    if (col === 'curr_qty') return mCurrQty
    if (col === 'cmp') return livePrices[trade.ticker]?.price || 0
    if (col === 'unrealised') {
      const mLp = livePrices[trade.ticker]?.price
      if (!mLp || mCurrQty === 0) return -Infinity
      return trade.direction === 'LONG' ? (mLp - mEntry) * mCurrQty : (mEntry - mLp) * mCurrQty
    }
    if (col === 'realised') return mExs.length > 0 ? mExs.reduce((s,e) => s+(Number(e.price)-mEntry)*Number(e.quantity), 0) : (Number(trade.realized_gains)||0)
    if (col === 'mtf_int') {
      const mInv = Number(trade.invested_capital) || (mEntry * mOrigQty)
      const mActInv = Number(trade.actual_investment) || 0
      const mBase = mInv - mActInv
      if (!mBase || !trade.mtf_interest_rate || !trade.entry_date) return 0
      return mBase * (mCurrQty/mOrigQty) * trade.mtf_interest_rate * Math.max(1, Math.floor((new Date() - new Date(trade.entry_date))/86400000)) / 36500
    }
    return trade[col]
  }

  const mApplySort = (list) => {
    if (!mSortCol) return list
    const computed = ['curr_qty','unrealised','realised','mtf_int','cmp']
    return [...list].sort((a,b) => {
      let av = computed.includes(mSortCol) ? mComputeVal(a, mSortCol) : a[mSortCol]
      let bv = computed.includes(mSortCol) ? mComputeVal(b, mSortCol) : b[mSortCol]
      if (typeof av==='string') av=av.toLowerCase(), bv=(bv||'').toLowerCase()
      if (av==null||av===-Infinity) av=mSortDir==='asc'?Infinity:-Infinity
      if (bv==null||bv===-Infinity) bv=mSortDir==='asc'?Infinity:-Infinity
      return mSortDir==='asc'?(av>bv?1:-1):(av<bv?1:-1)
    })
  }

  const baseFiltered = mirrorFilter === 'ALL' ? mTrades : mTrades.filter(t => t.status === mirrorFilter)
  const filtered = mApplySort(baseFiltered)
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
          <div style={{ overflowX:'auto', border:'1px solid var(--border)', borderRadius:'8px' }}>
            <table className="trade-table" style={{ width:'100%' }}>
              <thead>
                <tr>
                  {[['ticker','Ticker'],['direction','Dir'],['account','Account'],['entry_date','Entry Date'],['entry_price','Entry Rs.'],['cmp','CMP'],['exit_price','Exit Rs.'],['quantity','Qty'],['curr_qty','Curr Qty'],['invested_capital','Investment'],['actual_investment','Actual Inv'],['mtf_int','MTF Int'],['unrealised','Unrealised P&L'],['realised','Realised P&L'],['status','Status']].map(([col,label],i) => (
                    <th key={i} className={i>=4&&i<14?'right':''} onClick={() => mDoSort(col)}
                      style={{ cursor:'pointer', userSelect:'none', whiteSpace:'nowrap' }}>
                      {label}{mSortIcon(col)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(trade => {
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
                      <td><span className="ticker-badge">{trade.ticker}</span></td>
                      <td><span className={`badge badge-${trade.direction.toLowerCase()}`}>{trade.direction}</span></td>
                      <td className="muted" style={{ fontSize:'11px' }}>{trade.account||'—'}</td>
                      <td className="muted">{trade.entry_date?.slice(0,10)}</td>
                      <td className="right">\{toINRd(entryPrice)}</td>
                      <td className="right">{cmp ? <div><div style={{ fontWeight:600 }}>\{toINRd(cmp)}</div><div style={{ fontSize:'10px', color:lp.change>=0?'var(--bull)':'var(--bear)' }}>{lp.change>=0?'+':''}{lp.changePercent?.toFixed(2)}%</div></div> : <span className="neutral">—</span>}</td>
                      <td className="right">{exitPrice ? `\${toINRd(exitPrice)}` : <span className="neutral">—</span>}</td>
                      <td className="right">{toINR(originalQty)}</td>
                      <td className="right"><span style={{ fontWeight:700, color:currentQty===0?'var(--bear)':currentQty<originalQty?'var(--gold)':'var(--text)' }}>{toINR(currentQty)}</span></td>
                      <td className="right">{investment ? `\${toINRd(investment)}` : <span className="neutral">—</span>}</td>
                      <td className="right">{actualInv ? `\${toINRd(actualInv)}` : <span className="neutral">—</span>}</td>
                      <td className="right">{mtfInt ? <span style={{ color:'var(--gold)' }}>\{toINRd(mtfInt)}</span> : <span className="neutral">—</span>}</td>
                      <td className="right">{unrealisedPnL !== null ? <span style={{ color:unrealisedPnL>=0?'var(--bull)':'var(--bear)', fontWeight:600 }}>{unrealisedPnL>=0?'+':'−'}{toINRd(Math.abs(unrealisedPnL))}</span> : <span className="neutral">—</span>}</td>
                      <td className="right">{realisedPnL !== 0 || trade.status==='CLOSED' ? <span style={{ color:realisedPnL>=0?'var(--bull)':'var(--bear)', fontWeight:600 }}>{realisedPnL>=0?'+':'−'}{toINRd(Math.abs(realisedPnL))}</span> : <span className="neutral">—</span>}</td>
                      <td className="right"><span style={{ fontSize:'10px', fontWeight:700, color:trade.status==='OPEN'?'var(--bull)':'var(--muted)', background:trade.status==='OPEN'?'rgba(0,230,118,0.1)':'var(--surface)', padding:'2px 8px', borderRadius:'4px' }}>{trade.status}</span></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
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
    { label:'Unrealised P&L', value:`${acUnrealised>=0?'+':'−'}${toINRd(acUnrealised)}`, color:acUnrealised>=0?'var(--bull)':'var(--bear)' },
    { label:'Realised P&L',   value:`${acRealised>=0?'+':'−'}${toINRd(acRealised)}`,   color:acRealised>=0?'var(--bull)':'var(--bear)' },
    { label:'Open Positions', value:acOpen,   color:'var(--accent)' },
    { label:'Closed Trades',  value:acClosed, color:'var(--muted)' },
    { label:'MTF Interest',   value:`\${toINRd(acMTF)}`, color:'var(--gold)' },
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
  const [mirrorFilter, setMirrorFilter] = useState('ALL')
  const [selectedMonth, setSelectedMonth] = useState(null) // 'YYYY-MM' or null=ALL
  const [sortCol, setSortCol] = useState(null)
  const [sortDir, setSortDir] = useState('asc')
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
    const token = await getToken()
    const [tRes, aRes] = await Promise.all([
      fetch('/api/trades', { headers:{ Authorization:`Bearer ${token}` } }),
      fetch('/api/accounts', { headers:{ Authorization:`Bearer ${token}` } }),
    ])
    const tData = await tRes.json()
    const aData = await aRes.json()
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

  const doSort = (col) => {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(col); setSortDir('asc') }
  }
  const sortIcon = (col) => sortCol === col ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ' ↕'

  const computeSortVal = (trade, col) => {
    const exs = executions[trade.id] || []
    const totalSold = exs.reduce((s,e) => s + Number(e.quantity), 0)
    const origQty = Number(trade.quantity) || 0
    const currQty = Math.max(0, origQty - totalSold)
    const entry = Number(trade.entry_price) || 0
    const investment = Number(trade.invested_capital) || (entry * origQty)
    const actualInv = Number(trade.actual_investment) || 0
    const mtfBase = investment - actualInv
    switch(col) {
      case 'curr_qty': return currQty
      case 'unrealised': {
        const lp = livePrices[trade.ticker]?.price
        if (!lp || currQty === 0) return -Infinity
        return trade.direction === 'LONG' ? (lp - entry) * currQty : (entry - lp) * currQty
      }
      case 'realised': {
        if (exs.length > 0) return exs.reduce((s,e) => s + (Number(e.price) - entry) * Number(e.quantity), 0)
        return Number(trade.realized_gains) || 0
      }
      case 'mtf_int': {
        if (!mtfBase || !trade.mtf_interest_rate || !trade.entry_date) return 0
        const days = Math.max(1, Math.floor((new Date() - new Date(trade.entry_date)) / 86400000))
        return mtfBase * (currQty/origQty) * trade.mtf_interest_rate * days / 36500
      }
      case 'cmp': return livePrices[trade.ticker]?.price || 0
      default: return a => a[col]
    }
  }

  const applySortToTrades = (tradeList) => {
    if (!sortCol) return tradeList
    return [...tradeList].sort((a, b) => {
      const computed = ['curr_qty','unrealised','realised','mtf_int','cmp']
      let av = computed.includes(sortCol) ? computeSortVal(a, sortCol) : a[sortCol]
      let bv = computed.includes(sortCol) ? computeSortVal(b, sortCol) : b[sortCol]
      if (typeof av === 'string') av = av.toLowerCase(), bv = (bv||'').toLowerCase()
      if (av == null || av === -Infinity) av = sortDir === 'asc' ? Infinity : -Infinity
      if (bv == null || bv === -Infinity) bv = sortDir === 'asc' ? Infinity : -Infinity
      return sortDir === 'asc' ? (av > bv ? 1 : -1) : (av < bv ? 1 : -1)
    })
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

  if (!session) return null

  // Pre-compute mirrored execs map for right panel (no IIFE in JSX)
  const activeMirrorExecsMap = (() => {
    if (!activeMirror) return {}
    const mExecs = mirroredExecs[activeMirror] || []
    return mExecs.reduce((m, e) => { if (!m[e.trade_id]) m[e.trade_id] = []; m[e.trade_id].push(e); return m }, {})
  })()
  const activeMirrorTrades = activeMirror ? (mirroredTrades[activeMirror] || []) : []

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
          <button onClick={() => { loadData(); if(isAdmin) loadMirroredAccounts() }}
            style={{ background:'none', border:'1px solid var(--border)', borderRadius:'4px', color:'var(--muted)', cursor:'pointer', fontSize:'11px', padding:'4px 10px', fontFamily:'DM Mono, monospace' }}>
            ↻ {openTrades.length > 0 ? `${countdown}s` : 'Refresh'}
          </button>
          <button onClick={() => setShowAdd(true)} className="btn btn-primary" style={{ padding:'6px 14px', fontSize:'11px' }}>+ New Trade</button>
          <ExitMenu />
        </div>
      </header>

      <main style={{ maxWidth:'100%', margin:'0 auto', padding:'20px 24px' }}>

        {/* ── AGGREGATE STATS (always visible) ── */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(150px,1fr))', gap:'10px', marginBottom:'20px' }}>
          {[
            { label:'Unrealised P&L', value:`${totalUnrealised>=0?'+':'−'}${toINRd(Math.abs(totalUnrealised))}`, color:totalUnrealised>=0?'var(--bull)':'var(--bear)' },
            { label:'Realised P&L', value:`${totalRealised>=0?'+':'−'}${toINRd(Math.abs(totalRealised))}`, color:totalRealised>=0?'var(--bull)':'var(--bear)' },
            { label:'Open Positions', value:totalOpen, color:'var(--accent)' },
            { label:'Closed Trades', value:totalClosed },
            { label:'MTF Interest', value:`\${toINRd(totalMTF)}`, color:'var(--gold)' },
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

            {(() => {
              const monthFiltered = selectedMonth
                ? filtered.filter(t => t.entry_date && t.entry_date.slice(0,7) === selectedMonth)
                : filtered
              return monthFiltered.length === 0 ? (
              <div style={{ textAlign:'center', padding:'60px', color:'var(--muted)', border:'1px dashed var(--border)', borderRadius:'8px' }}>
  <div style={{ marginBottom:'14px' }}>{selectedMonth ? 'No trades in this month.' : 'No trades yet.'}</div>
  {!selectedMonth && <button onClick={() => setShowAdd(true)} className="btn btn-primary" style={{ padding:'8px 20px', fontSize:'12px' }}>+ New Trade</button>}
</div>
            ) : (
              <div style={{ overflowX:'auto' }}>
                <table className="trade-table" style={{ width:'100%', tableLayout:'fixed', fontSize:'11px' }}>
                  <colgroup>
                    <col style={{ width:'80px' }} />{/* Ticker */}
                    <col style={{ width:'60px' }} />{/* Direction */}
                    <col style={{ width:'82px' }} />{/* Entry Date */}
                    <col style={{ width:'82px' }} />{/* Entry Rs. */}
                    <col style={{ width:'90px' }} />{/* CMP */}
                    <col style={{ width:'82px' }} />{/* Exit Rs. */}
                    <col style={{ width:'60px' }} />{/* Qty */}
                    <col style={{ width:'70px' }} />{/* Curr Qty */}
                    <col style={{ width:'90px' }} />{/* Investment */}
                    <col style={{ width:'85px' }} />{/* Actual Inv */}
                    <col style={{ width:'85px' }} />{/* MTF */}
                    <col style={{ width:'100px' }} />{/* Unrealised */}
                    <col style={{ width:'100px' }} />{/* Realised */}
                    <col style={{ width:'60px' }} />{/* Actions */}
                  </colgroup>
                  <thead>
                    <tr>
                      {[['ticker','Ticker'],['direction','Dir'],['entry_date','Entry Date'],['entry_price','Entry Rs.'],['cmp','CMP'],['exit_price','Exit Rs.'],['quantity','Qty'],['curr_qty','Curr Qty'],['invested_capital','Investment'],['actual_investment','Actual Inv'],['mtf_int','MTF Int'],['unrealised','Unrealised P&L'],['realised','Realised P&L'],['','Action']].map(([col,label],i) => (
                        <th key={i} className={i>=3&&i<13?'right':''} onClick={() => col && doSort(col)}
                          style={{ cursor:col?'pointer':'default', userSelect:'none', whiteSpace:'nowrap' }}>
                          {label}{col ? sortIcon(col) : ''}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr style={{ background:'var(--accent)', cursor:'pointer' }} onClick={() => setShowAdd(true)}>
                      <td colSpan={14} style={{ padding:'10px', textAlign:'center', borderBottom:'1px solid rgba(255,255,255,0.15)' }}>
                        <span style={{ color:'#000', fontSize:'12px', fontFamily:'DM Mono, monospace', fontWeight:700, letterSpacing:'0.08em' }}>+ New Trade</span>
                      </td>
                    </tr>
                    {applySortToTrades(monthFiltered).map(trade => {
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
                            <td className="right">\{toINRd(entryPrice)}</td>
                            <td className="right">
                              {isOpen && lp ? <div><div style={{ fontWeight:600 }}>\{toINRd(lp.price)}</div><div style={{ fontSize:'10px', color:lp.change>=0?'var(--bull)':'var(--bear)' }}>{lp.change>=0?'+':''}{lp.changePercent?.toFixed(2)}%</div></div> : <span className="neutral">—</span>}
                            </td>
                            <td className="right">{exitPrice ? `\${toINRd(exitPrice)}` : <span className="neutral">—</span>}</td>
                            <td className="right">{toINR(originalQty)}</td>
                            <td className="right"><span style={{ fontWeight:700, color:currentQty===0?'var(--bear)':currentQty<originalQty?'var(--gold)':'var(--text)' }}>{toINR(currentQty)}</span></td>
                            <td className="right">{investment ? `\${toINRd(investment)}` : <span className="neutral">—</span>}</td>
                            <td className="right">{actualInv ? `\${toINRd(actualInv)}` : <span className="neutral">—</span>}</td>
                            <td className="right">{mtfInt ? <span style={{ color:'var(--gold)' }}>\{toINRd(mtfInt)}</span> : <span className="neutral">—</span>}</td>
                            <td className="right">{unrealisedPnL !== null ? <span style={{ color:unrealisedPnL>=0?'var(--bull)':'var(--bear)', fontWeight:600 }}>{unrealisedPnL>=0?'+':'−'}{toINRd(Math.abs(unrealisedPnL))}</span> : <span className="neutral">—</span>}</td>
                            <td className="right">{realisedPnL !== 0 || trade.status==='CLOSED' ? <span style={{ color:realisedPnL>=0?'var(--bull)':'var(--bear)', fontWeight:600 }}>{realisedPnL>=0?'+':'−'}{toINRd(Math.abs(realisedPnL))}</span> : <span className="neutral">—</span>}</td>
                            <td style={{ textAlign:'center', position:'relative' }} onClick={e => e.stopPropagation()}>
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
            )})()}
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
