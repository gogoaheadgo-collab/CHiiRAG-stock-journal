import React, { useState, useEffect, useCallback, useMemo } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'
import { supabase } from '../lib/supabase'
import Sidebar from '../components/Sidebar'

const ADMIN = 'gogoaheadgo@gmail.com'
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

const COLUMN_INFO = {
  month: 'Calendar month',
  added: 'Capital added to this account during the month',
  withdrawn: 'Capital withdrawn from this account during the month',
  startingCapital: 'Final capital carried forward from the previous month (0 for the very first month with no prior data)',
  netPL: 'Realised P&L from trades exited in this account during the month',
  pctPL: 'Net P/L as a percentage of Starting Capital',
  finalCapital: 'Starting Capital + Added − Withdrawn + Net P/L',
  trades: 'Number of trades closed (exited) in this account during the month',
  winRate: "Percentage of this month's closed trades that were profitable",
  avgGain: "Average % gain of this month's winning trades",
  avgLoss: "Average % loss of this month's losing trades",
  avgR: "Average R-multiple (P&L ÷ risk) among this month's stop-loss-tagged trades",
}

function FlowPopover({ month, year, type, onClose, onSubmit }) {
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(`${year}-${String(month).padStart(2,'0')}-01`)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const submit = async () => {
    if (!amount || Number(amount) <= 0) { setError('Enter a valid amount'); return }
    setSaving(true)
    setError('')
    try {
      await onSubmit({ date, amount: parseFloat(amount), type })
      onClose()
    } catch (e) {
      setError(e.message || 'Failed to save')
    }
    setSaving(false)
  }

  return (
    <div onClick={e => e.stopPropagation()} style={{ position:'absolute', top:'calc(100% + 4px)', left:0, zIndex:200, background:'var(--bg)', border:'1px solid var(--border)', borderRadius:'8px', padding:'12px', boxShadow:'0 8px 24px rgba(0,0,0,0.2)', width:'190px', textAlign:'left' }}>
      <div style={{ fontSize:'10px', color:'var(--muted)', fontFamily:'DM Mono, monospace', marginBottom:'8px', textTransform:'uppercase', letterSpacing:'0.08em' }}>
        {type === 'ADD' ? 'Add Funds' : 'Withdraw Funds'}
      </div>
      <input type="number" value={amount} onChange={e=>setAmount(e.target.value)} placeholder="Amount ₹" autoFocus
        style={{ width:'100%', boxSizing:'border-box', background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'5px', padding:'6px 10px', color:'var(--text)', fontSize:'12px', fontFamily:'DM Mono, monospace', outline:'none', marginBottom:'8px' }} />
      <input type="date" value={date} onChange={e=>setDate(e.target.value)}
        style={{ width:'100%', boxSizing:'border-box', background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'5px', padding:'6px 10px', color:'var(--text)', fontSize:'12px', fontFamily:'DM Mono, monospace', outline:'none', marginBottom:'8px' }} />
      {error && <div style={{ color:'var(--bear)', fontSize:'10px', marginBottom:'8px' }}>{error}</div>}
      <div style={{ display:'flex', gap:'6px' }}>
        <button onClick={onClose} style={{ flex:1, padding:'6px', background:'none', border:'1px solid var(--border)', borderRadius:'5px', color:'var(--muted)', cursor:'pointer', fontSize:'11px', fontFamily:'DM Mono, monospace' }}>Cancel</button>
        <button onClick={submit} disabled={saving} style={{ flex:1, padding:'6px', background:'var(--accent)', border:'none', borderRadius:'5px', color:'#fff', cursor:saving?'not-allowed':'pointer', fontSize:'11px', fontFamily:'DM Mono, monospace', fontWeight:700, opacity:saving?0.7:1 }}>{saving?'...':'Save'}</button>
      </div>
    </div>
  )
}

export default function FundManagementPage() {
  const router = useRouter()
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(false)
  const [accounts, setAccounts] = useState([])
  const [trades, setTrades] = useState([])
  const [executions, setExecutions] = useState({})
  const [activeAccount, setActiveAccount] = useState(null)
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const [fundFlows, setFundFlows] = useState([])
  const [flowPopover, setFlowPopover] = useState(null) // { month, type }

  const isAdmin = session?.user?.email === ADMIN
  const getToken = async () => (await supabase.auth.getSession()).data.session?.access_token

  useEffect(() => {
    supabase.auth.getSession().then(({ data:{ session } }) => { setSession(session); if (!session) router.push('/') })
    const { data:{ subscription } } = supabase.auth.onAuthStateChange((_,s) => { setSession(s); if (!s) router.push('/') })
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    const close = () => setFlowPopover(null)
    document.addEventListener('click', close)
    return () => document.removeEventListener('click', close)
  }, [])

  const loadData = useCallback(async () => {
    if (!session) return
    setLoading(prev => trades.length === 0 ? true : prev)
    const [{ data: aData }, { data: tData }] = await Promise.all([
      supabase.from('accounts').select('*').eq('user_id', session.user.id).order('name'),
      supabase.from('trades').select('*').eq('user_id', session.user.id).order('entry_date', { ascending: false }),
    ])
    if (Array.isArray(aData)) {
      setAccounts(aData)
      if (aData.length > 0) setActiveAccount(prev => prev || aData[0].name)
    }
    if (Array.isArray(tData)) {
      setTrades(tData)
      if (tData.length > 0) {
        const tradeIds = tData.map(t => t.id)
        const { data: eData } = await supabase.from('executions').select('*').in('trade_id', tradeIds).eq('user_id', session.user.id)
        const map = {}
        tData.forEach(t => { map[t.id] = [] })
        ;(eData || []).forEach(e => { if (map[e.trade_id] !== undefined) map[e.trade_id].push(e) })
        setExecutions(map)
      } else {
        setExecutions({})
      }
    }
    setLoading(false)
  }, [session]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { if (session) loadData() }, [session, loadData])

  const loadFundFlows = useCallback(async () => {
    if (!session || !activeAccount) { setFundFlows([]); return }
    const token = await getToken()
    const res = await fetch(`/api/fund-flows?account=${encodeURIComponent(activeAccount)}`, { headers:{ Authorization:`Bearer ${token}` } })
    const data = await res.json()
    if (Array.isArray(data)) setFundFlows(data)
  }, [session, activeAccount])

  useEffect(() => { loadFundFlows() }, [loadFundFlows])

  const handleAddFlow = async ({ date, amount, type }) => {
    const token = await getToken()
    const res = await fetch('/api/fund-flows', { method:'POST', headers:{ 'Content-Type':'application/json', Authorization:`Bearer ${token}` }, body: JSON.stringify({ account_name: activeAccount, date, amount, type }) })
    const data = await res.json()
    if (data.error) throw new Error(data.error)
    await loadFundFlows()
  }

  const signOut = async () => { await supabase.auth.signOut(); window.location.href = '/' }

  const handleDeleteMyAccount = async () => {
    if (isAdmin) return
    const confirmed = window.confirm('⚠️ PERMANENTLY DELETE YOUR ACCOUNT?\n\nThis will erase ALL your trades, executions, and account history.\n\nThis CANNOT be undone.')
    if (!confirmed) return
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

  const toINRd = n => Number(n||0).toLocaleString('en-IN', { minimumFractionDigits:2, maximumFractionDigits:2 })

  const monthlyRows = useMemo(() => {
    if (!activeAccount) return []
    const accountTrades = trades.filter(t => t.account === activeAccount)
    const execList = accountTrades.flatMap(t => executions[t.id] || [])
    const getTradeRealised = (t) => {
      const execs = execList.filter(e => e.trade_id === t.id)
      if (execs.length > 0) return execs.reduce((s,e) => s + (Number(e.price) - Number(t.entry_price)) * Number(e.quantity), 0)
      return Number(t.realized_gains) || 0
    }
    const closedTrades = accountTrades.filter(t => t.status === 'CLOSED' && t.exit_date)

    const allDates = [
      ...fundFlows.map(f => f.date),
      ...closedTrades.map(t => t.exit_date.slice(0,10)),
    ]
    let startYear = selectedYear
    if (allDates.length > 0) {
      const minYear = Number(allDates.reduce((a,b) => a < b ? a : b).slice(0,4))
      startYear = Math.min(selectedYear, minYear)
    }

    const rows = []
    let runningCapital = 0
    for (let y = startYear; y <= selectedYear; y++) {
      for (let m = 1; m <= 12; m++) {
        const ym = `${y}-${String(m).padStart(2,'0')}`
        const monthFlows = fundFlows.filter(f => f.date.slice(0,7) === ym)
        const added = monthFlows.filter(f => f.type === 'ADD').reduce((s,f) => s + Number(f.amount), 0)
        const withdrawn = monthFlows.filter(f => f.type === 'WITHDRAW').reduce((s,f) => s + Number(f.amount), 0)

        const monthTrades = closedTrades.filter(t => t.exit_date.slice(0,7) === ym)
        const pnls = monthTrades.map(t => getTradeRealised(t))
        const netPL = pnls.reduce((s,p) => s + p, 0)
        const startingCapital = runningCapital
        const pctPL = startingCapital > 0 ? (netPL / startingCapital * 100) : null
        const finalCapital = startingCapital + added - withdrawn + netPL
        runningCapital = finalCapital

        const pctReturn = (t, pnl) => {
          const inv = Number(t.actual_investment) || Number(t.invested_capital) || (Number(t.entry_price) * Number(t.quantity)) || 0
          return inv > 0 ? (pnl / inv * 100) : null
        }
        const winPcts = monthTrades.map((t,i) => pnls[i] > 0 ? pctReturn(t, pnls[i]) : null).filter(x => x !== null)
        const lossPcts = monthTrades.map((t,i) => pnls[i] <= 0 ? pctReturn(t, pnls[i]) : null).filter(x => x !== null)
        const avgGain = winPcts.length > 0 ? winPcts.reduce((s,x)=>s+x,0)/winPcts.length : null
        const avgLoss = lossPcts.length > 0 ? lossPcts.reduce((s,x)=>s+x,0)/lossPcts.length : null
        const winCount = monthTrades.filter((t,i) => pnls[i] > 0).length
        const winRate = monthTrades.length > 0 ? (winCount / monthTrades.length * 100) : null

        const withSL = monthTrades.filter(t => t.stop_loss && Number(t.stop_loss) > 0 && Number(t.stop_loss) !== Number(t.entry_price))
        const rMults = withSL.map(t => {
          const pnl = getTradeRealised(t)
          const risk = Math.abs(Number(t.entry_price) - Number(t.stop_loss))
          return risk > 0 ? pnl / (risk * Number(t.quantity)) : null
        }).filter(x => x !== null)
        const avgR = rMults.length > 0 ? rMults.reduce((s,x)=>s+x,0)/rMults.length : null

        if (y === selectedYear) {
          rows.push({ year:y, month:m, added, withdrawn, startingCapital, netPL, pctPL, finalCapital, trades: monthTrades.length, winRate, avgGain, avgLoss, avgR })
        }
      }
    }
    return rows
  }, [trades, executions, fundFlows, activeAccount, selectedYear])

  if (!session) return null

  return (
    <>
      <div className="tricolor-bar" />
      <Head><title>Fund Management — SMK Stock Journal</title></Head>
      <Sidebar active="Fund Management" isAdmin={isAdmin} user={session?.user} onSignOut={signOut} onDeleteAccount={!isAdmin ? handleDeleteMyAccount : undefined} />

      <main className="sidebar-offset" style={{ padding:'28px 32px 40px' }}>

        <div style={{ marginBottom:'20px' }}>
          <h1 style={{ fontFamily:'Bookman Old Style, serif', fontWeight:800, fontSize:'24px', color:'var(--text)', margin:0 }}>Fund Management</h1>
          <div style={{ fontSize:'11px', color:'var(--muted)', marginTop:'4px', fontFamily:'DM Mono, monospace' }}>Dated capital ledger — monthly walk-forward per account</div>
        </div>

        {loading ? (
          <div style={{ textAlign:'center', padding:'60px', color:'var(--muted)' }}>Loading...</div>
        ) : accounts.length === 0 ? (
          <div style={{ textAlign:'center', padding:'80px', color:'var(--muted)' }}>No accounts yet. Create one from the Accounts page.</div>
        ) : (
          <>
            {/* Account Picker */}
            <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'20px', flexWrap:'wrap' }}>
              {accounts.map(acc => (
                <button key={acc.id} onClick={() => setActiveAccount(acc.name)} style={{
                  border:`2px solid ${activeAccount===acc.name?'var(--accent)':'var(--border)'}`,
                  background:activeAccount===acc.name?'var(--accent-dim)':'var(--surface)',
                  borderRadius:'10px', minWidth:'120px', padding:'14px 16px', cursor:'pointer', textAlign:'left',
                }}>
                  <div style={{ fontSize:'14px', fontWeight:700, fontFamily:'DM Mono, monospace', color:activeAccount===acc.name?'var(--accent)':'var(--text)' }}>{acc.name}</div>
                  <div style={{ fontSize:'10px', color:'var(--muted)', marginTop:'3px' }}>{trades.filter(t=>t.account===acc.name).length} trades</div>
                </button>
              ))}
            </div>

            {/* Year Selector */}
            <div style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'16px' }}>
              <button onClick={() => setSelectedYear(y => y-1)} style={{ background:'none', border:'1px solid var(--border)', color:'var(--muted)', borderRadius:'4px', padding:'4px 10px', cursor:'pointer', fontSize:'13px' }}>‹</button>
              <span style={{ fontFamily:'DM Mono, monospace', fontWeight:700, fontSize:'14px', color:'var(--text)' }}>{selectedYear}</span>
              <button onClick={() => setSelectedYear(y => y+1)} style={{ background:'none', border:'1px solid var(--border)', color:'var(--muted)', borderRadius:'4px', padding:'4px 10px', cursor:'pointer', fontSize:'13px' }}>›</button>
            </div>

            {!activeAccount ? null : (
              <div style={{ border:'1px solid var(--border)', borderRadius:'8px', overflow:'visible' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      {[
                        { key:'month', label:'Month' },
                        { key:'added', label:'Added' },
                        { key:'withdrawn', label:'Withdrawn' },
                        { key:'startingCapital', label:'Starting Capital' },
                        { key:'netPL', label:'Net P/L' },
                        { key:'pctPL', label:'% P/L' },
                        { key:'finalCapital', label:'Final Capital' },
                        { key:'trades', label:'Trades' },
                        { key:'winRate', label:'% Win' },
                        { key:'avgGain', label:'Avg Gain' },
                        { key:'avgLoss', label:'Avg Loss' },
                        { key:'avgR', label:'Monthly Avg R' },
                      ].map(col => (
                        <th key={col.key} className={col.key!=='month'?'r':undefined} title={COLUMN_INFO[col.key]}>{col.label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {monthlyRows.map(row => (
                      <tr key={`${row.year}-${row.month}`}>
                        <td style={{ fontFamily:'DM Mono, monospace', fontWeight:700, color:'var(--text)' }}>{MONTHS[row.month-1]}</td>
                        <td className="num" style={{ position:'relative' }}>
                          {row.added > 0 ? <span style={{ color:'var(--bull)' }}>+Rs.{toINRd(row.added)}</span> : <span style={{ color:'var(--muted)' }}>—</span>}
                          <button onClick={e => { e.stopPropagation(); setFlowPopover(p => (p?.month===row.month && p?.type==='ADD') ? null : { month: row.month, type: 'ADD' }) }}
                            style={{ marginLeft:'6px', background:'none', border:'none', color:'var(--muted)', cursor:'pointer', fontSize:'11px', verticalAlign:'middle' }} title="Record a fund addition">✎</button>
                          {flowPopover?.month === row.month && flowPopover?.type === 'ADD' && (
                            <FlowPopover month={row.month} year={selectedYear} type="ADD" onClose={() => setFlowPopover(null)} onSubmit={handleAddFlow} />
                          )}
                        </td>
                        <td className="num" style={{ position:'relative' }}>
                          {row.withdrawn > 0 ? <span style={{ color:'var(--bear)' }}>−Rs.{toINRd(row.withdrawn)}</span> : <span style={{ color:'var(--muted)' }}>—</span>}
                          <button onClick={e => { e.stopPropagation(); setFlowPopover(p => (p?.month===row.month && p?.type==='WITHDRAW') ? null : { month: row.month, type: 'WITHDRAW' }) }}
                            style={{ marginLeft:'6px', background:'none', border:'none', color:'var(--muted)', cursor:'pointer', fontSize:'11px', verticalAlign:'middle' }} title="Record a fund withdrawal">✎</button>
                          {flowPopover?.month === row.month && flowPopover?.type === 'WITHDRAW' && (
                            <FlowPopover month={row.month} year={selectedYear} type="WITHDRAW" onClose={() => setFlowPopover(null)} onSubmit={handleAddFlow} />
                          )}
                        </td>
                        <td className="num">Rs.{toINRd(row.startingCapital)}</td>
                        <td className="num"><span style={{ color: row.netPL>=0?'var(--bull)':'var(--bear)', fontWeight:700 }}>{row.netPL>=0?'+':'−'}Rs.{toINRd(Math.abs(row.netPL))}</span></td>
                        <td className="num">{row.pctPL == null ? <span style={{ color:'var(--muted)' }}>—</span> : <span style={{ color: row.pctPL>=0?'var(--bull)':'var(--bear)' }}>{row.pctPL>=0?'+':''}{row.pctPL.toFixed(2)}%</span>}</td>
                        <td className="num" style={{ fontWeight:700 }}>Rs.{toINRd(row.finalCapital)}</td>
                        <td className="num">{row.trades > 0 ? row.trades : <span style={{ color:'var(--muted)' }}>—</span>}</td>
                        <td className="num">{row.winRate == null ? <span style={{ color:'var(--muted)' }}>—</span> : `${row.winRate.toFixed(1)}%`}</td>
                        <td className="num">{row.avgGain == null ? <span style={{ color:'var(--muted)' }}>—</span> : <span style={{ color:'var(--bull)' }}>+{row.avgGain.toFixed(2)}%</span>}</td>
                        <td className="num">{row.avgLoss == null ? <span style={{ color:'var(--muted)' }}>—</span> : <span style={{ color:'var(--bear)' }}>{row.avgLoss.toFixed(2)}%</span>}</td>
                        <td className="num">{row.avgR == null ? <span style={{ color:'var(--muted)' }}>—</span> : <span style={{ color: row.avgR>=0?'var(--bull)':'var(--bear)' }}>{row.avgR>=0?'+':''}{row.avgR.toFixed(2)}R</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </main>
    </>
  )
}
