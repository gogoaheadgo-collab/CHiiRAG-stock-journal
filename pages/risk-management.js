import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'
import { supabase } from '../lib/supabase'
import Sidebar from '../components/Sidebar'
import { buildRow, summarize } from '../lib/riskCalc'
import { COLUMNS, downloadRiskWorkbook } from '../lib/riskExcel'

const ADMIN = 'gogoaheadgo@gmail.com'
// Only trades bought on or after this date are part of Risk Management
const START_DATE = '2026-09-25'
const memberKey = m => `${m.owner_id}::${m.account}`
const mono = 'DM Mono, monospace'

const COLUMN_INFO = {
  riskPct: 'Entered here. 1 = 1% of account',
  sl: 'Original stop loss, entered here',
  sellPrice: 'Weighted average of all exits. Open trades: live CMP',
  sellDate: 'Last exit date. Open trades: today',
  netBuy: 'Quantity × Buy Price',
  netSell: 'Quantity × Sell Price',
  mtf: 'MTF interest accrued on this trade',
  netPL: 'Net Sell Value − Net Buy Value − MTF Interest',
  plPct: 'Net P/L ÷ Net Buy Value',
  days: 'Sell Date − Buy Date',
  slPct: '1 − Buy Price ÷ Stop loss',
  grossR: 'P/L % ÷ |Stop Loss %| (losses negative)',
  netR: 'Gross R × Risk % — % of account gained/lost',
  mae: 'MEA — entered here',
}

const inputStyle = { width:'100%', boxSizing:'border-box', background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'5px', padding:'7px 10px', color:'var(--text)', fontSize:'12px', fontFamily:mono, outline:'none' }

const toINRd = n => Number(n||0).toLocaleString('en-IN', { minimumFractionDigits:2, maximumFractionDigits:2 })
const pct = (x, d=2) => x === null || x === undefined ? null : `${(x*100).toFixed(d)}%`
const fmtDate = s => s ? new Date(s + 'T00:00:00').toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'2-digit' }) : null
const Dash = () => <span style={{ color:'var(--muted)' }}>—</span>
const Signed = ({ v, children }) => <span style={{ color: v >= 0 ? 'var(--bull)' : 'var(--bear)', fontWeight:600 }}>{children}</span>

// Inline editable cell; saves on blur / Enter when the value changed
function InputCell({ value, onSave, type='number', width=70, placeholder, list }) {
  const [v, setV] = useState(value ?? '')
  useEffect(() => { setV(value ?? '') }, [value])
  const commit = () => {
    const cur = value ?? ''
    if (String(v) === String(cur)) return
    onSave(v === '' ? null : (type === 'number' ? Number(v) : v))
  }
  return (
    <input type={type} value={v} placeholder={placeholder} list={list} step="any"
      onChange={e => setV(e.target.value)} onBlur={commit}
      onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur() }}
      style={{ width, boxSizing:'border-box', background:'transparent', border:'1px dashed var(--border)', borderRadius:'4px', padding:'3px 5px', color:'var(--text)', fontSize:'11px', fontFamily:mono, outline:'none', textAlign: type === 'number' ? 'right' : 'left' }} />
  )
}

// Setup picker: strategy list + any value already used, with "Custom…" to type a new one
function SetupCell({ value, options, onSave }) {
  const CUSTOM = '__custom__'
  const all = [...new Set([...(value ? [value] : []), ...options].filter(Boolean))]
  const change = e => {
    let v = e.target.value
    if (v === CUSTOM) {
      v = window.prompt('Enter setup name', value || '')
      if (v === null) return
      v = v.trim().toUpperCase()
    }
    if ((v || '') !== (value || '')) onSave(v || null)
  }
  return (
    <select value={value || ''} onChange={change}
      style={{ minWidth:'110px', background:'var(--surface)', border:'1px solid var(--accent)', borderRadius:'4px', padding:'3px 5px', color:'var(--text)', fontSize:'11px', fontFamily:mono, cursor:'pointer', outline:'none' }}>
      <option value="">— select —</option>
      {all.map(o => <option key={o} value={o}>{o}</option>)}
      <option value={CUSTOM}>+ Custom…</option>
    </select>
  )
}

function PortfolioModal({ initial, options, onClose, onSave }) {
  const [name, setName] = useState(initial?.name || '')
  const [size, setSize] = useState(initial?.portfolio_size ?? '')
  const [selected, setSelected] = useState(() => new Set((initial?.members || []).map(memberKey)))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const groups = useMemo(() => {
    const g = {}
    options.forEach(o => { (g[o.group] = g[o.group] || []).push(o) })
    return Object.entries(g)
  }, [options])

  const toggle = k => setSelected(prev => { const n = new Set(prev); n.has(k) ? n.delete(k) : n.add(k); return n })

  const submit = async () => {
    if (!name.trim()) { setError('Enter a portfolio name'); return }
    if (selected.size === 0) { setError('Pick at least one account'); return }
    setSaving(true); setError('')
    try {
      const members = options.filter(o => selected.has(memberKey(o))).map(o => ({ owner_id: o.owner_id, account: o.account }))
      await onSave({ name: name.trim(), members, portfolio_size: size === '' ? null : Number(size) })
      onClose()
    } catch (e) { setError(e.message || 'Failed to save') }
    setSaving(false)
  }

  return (
    <div onClick={onClose} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', zIndex:300, display:'flex', alignItems:'center', justifyContent:'center', padding:'16px' }}>
      <div onClick={e => e.stopPropagation()} style={{ background:'var(--bg)', border:'1px solid var(--border)', borderRadius:'10px', padding:'20px', width:'440px', maxWidth:'100%', maxHeight:'85vh', display:'flex', flexDirection:'column' }}>
        <div style={{ fontFamily:'Bookman Old Style, serif', fontWeight:800, fontSize:'18px', color:'var(--text)', marginBottom:'14px' }}>{initial ? 'Edit Portfolio' : 'New Portfolio'}</div>
        <label style={{ fontSize:'10px', color:'var(--muted)', fontFamily:mono, textTransform:'uppercase', letterSpacing:'0.08em' }}>Portfolio name</label>
        <input value={name} onChange={e => setName(e.target.value)} autoFocus placeholder="e.g. Portfolio 1" style={{ ...inputStyle, margin:'6px 0 14px' }} />
        <label style={{ fontSize:'10px', color:'var(--muted)', fontFamily:mono, textTransform:'uppercase', letterSpacing:'0.08em' }}>Portfolio size (₹)</label>
        <input type="number" value={size} onChange={e => setSize(e.target.value)} placeholder="e.g. 1000000" style={{ ...inputStyle, margin:'6px 0 14px' }} />
        <div style={{ fontSize:'10px', color:'var(--muted)', fontFamily:mono, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:'6px' }}>Accounts ({selected.size} selected)</div>
        <div style={{ overflowY:'auto', flex:1, border:'1px solid var(--border)', borderRadius:'6px', padding:'8px 10px' }}>
          {groups.length === 0 && <div style={{ color:'var(--muted)', fontSize:'12px' }}>Loading accounts…</div>}
          {groups.map(([group, opts]) => (
            <div key={group} style={{ marginBottom:'10px' }}>
              <div style={{ fontSize:'11px', fontWeight:700, color:'var(--accent)', fontFamily:mono, marginBottom:'4px' }}>{group}</div>
              {opts.map(o => (
                <label key={memberKey(o)} style={{ display:'flex', alignItems:'center', gap:'8px', padding:'3px 0', fontSize:'12px', color:'var(--text)', fontFamily:mono, cursor:'pointer' }}>
                  <input type="checkbox" checked={selected.has(memberKey(o))} onChange={() => toggle(memberKey(o))} />
                  {o.account} <span style={{ color:'var(--muted)', fontSize:'10px' }}>· {o.tradeCount} trades</span>
                </label>
              ))}
            </div>
          ))}
        </div>
        {error && <div style={{ color:'var(--bear)', fontSize:'11px', marginTop:'8px' }}>{error}</div>}
        <div style={{ display:'flex', gap:'8px', marginTop:'14px' }}>
          <button onClick={onClose} className="btn btn-ghost" style={{ flex:1 }}>Cancel</button>
          <button onClick={submit} disabled={saving} className="btn btn-primary" style={{ flex:1 }}>{saving ? 'Saving…' : 'Save'}</button>
        </div>
      </div>
    </div>
  )
}

function StatCard({ label, children, sub }) {
  return (
    <div style={{ border:'1px solid var(--border)', borderRadius:'8px', padding:'10px 12px', background:'var(--surface)', minWidth:'120px', flex:'1 1 120px' }}>
      <div style={{ fontSize:'9px', color:'var(--muted)', fontFamily:mono, textTransform:'uppercase', letterSpacing:'0.08em' }}>{label}</div>
      <div style={{ fontSize:'16px', fontWeight:700, fontFamily:mono, color:'var(--text)', marginTop:'4px' }}>{children}</div>
      {sub && <div style={{ fontSize:'10px', color:'var(--muted)', marginTop:'2px', fontFamily:mono }}>{sub}</div>}
    </div>
  )
}

function SummaryPanel({ s }) {
  const R = v => v === null ? <Dash /> : <Signed v={v}>{v >= 0 ? '+' : ''}{v.toFixed(2)}R</Signed>
  return (
    <>
      <div style={{ display:'flex', gap:'8px', flexWrap:'wrap', marginBottom:'10px' }}>
        <StatCard label="Win rate" sub={`${s.closedCount} closed · ${s.openCount} open`}>{s.winRate === null ? <Dash /> : pct(s.winRate, 1)}</StatCard>
        <StatCard label="Avg win / loss" sub={s.winLossRatio === null ? null : `W/L ratio ${s.winLossRatio.toFixed(2)}`}>
          {s.avgWin === null ? <Dash /> : <Signed v={1}>+{pct(s.avgWin)}</Signed>} / {s.avgLoss === null ? <Dash /> : <Signed v={-1}>{pct(s.avgLoss)}</Signed>}
        </StatCard>
        <StatCard label="Net P/L (closed)"><Signed v={s.totalPL}>{s.totalPL >= 0 ? '+' : '−'}₹{toINRd(Math.abs(s.totalPL))}</Signed></StatCard>
        <StatCard label="Total Net R" sub="% of account from closed trades">{s.totalNetR === null ? <Dash /> : <Signed v={s.totalNetR}>{s.totalNetR >= 0 ? '+' : ''}{s.totalNetR.toFixed(2)}</Signed>}</StatCard>
        <StatCard label="Expectancy" sub="avg Gross R per closed trade">{R(s.expectancy)}</StatCard>
        <StatCard label="Best / Worst R">{R(s.bestR)} / {R(s.worstR)}</StatCard>
        <StatCard label="Open risk (heat)"
          sub={[s.openRiskOfCapital !== null ? `${pct(s.openRiskOfCapital)} of ₹${toINRd(s.capital)}` : 'set Portfolio Size', s.openMissingSL ? `${s.openMissingSL} open w/o SL` : null].filter(Boolean).join(' · ')}>
          ₹{toINRd(s.openRisk)}
        </StatCard>
        <StatCard label="Open Risk % (sum)" sub="sum of Risk % on open trades">{s.openRiskPct.toFixed(2)}%</StatCard>
      </div>
      {s.bySetup.length > 0 && (
        <div style={{ border:'1px solid var(--border)', borderRadius:'8px', overflowX:'auto', marginBottom:'12px', maxWidth:'640px' }}>
          <table className="data-table" style={{ tableLayout:'auto' }}>
            <thead><tr><th>Setup</th><th className="r">Trades</th><th className="r">Win %</th><th className="r">Avg P/L %</th><th className="r">Avg Gross R</th><th className="r">Net P/L</th></tr></thead>
            <tbody>
              {s.bySetup.map(b => (
                <tr key={b.setup}>
                  <td style={{ fontFamily:mono, fontWeight:700 }}>{b.setup}</td>
                  <td className="num">{b.trades}</td>
                  <td className="num">{pct(b.winRate, 1)}</td>
                  <td className="num">{b.avgPL === null ? <Dash /> : <Signed v={b.avgPL}>{pct(b.avgPL)}</Signed>}</td>
                  <td className="num">{b.avgR === null ? <Dash /> : <Signed v={b.avgR}>{b.avgR.toFixed(2)}R</Signed>}</td>
                  <td className="num"><Signed v={b.netPL}>₹{toINRd(b.netPL)}</Signed></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}

function PortfolioSection({ p, data, strategies, onEdit, onDelete, onDownload, onExclude, onRestore, onSaveInput, onSaveSize }) {
  const [statusFilter, setStatusFilter] = useState('All')
  const [showExcluded, setShowExcluded] = useState(false)
  const { rows, excludedRows, summary, accountsLabel } = data
  const [sort, setSort] = useState(null) // { key, dir }
  const srNo = useMemo(() => new Map(rows.map((r,i) => [r.id, i + 1])), [rows])
  const visible = useMemo(() => {
    const list = rows.filter(r => statusFilter === 'All' || r.status === statusFilter)
    if (!sort) return list
    const val = r => sort.key === 'sr' ? srNo.get(r.id) : r[sort.key]
    return [...list].sort((a,b) => {
      const x = val(a), y = val(b)
      if (x === null || x === undefined || x === '') return 1   // blanks always last
      if (y === null || y === undefined || y === '') return -1
      const c = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y))
      return sort.dir === 'asc' ? c : -c
    })
  }, [rows, statusFilter, sort, srNo])
  const toggleSort = key => setSort(s => !s || s.key !== key ? { key, dir:'asc' } : s.dir === 'asc' ? { key, dir:'desc' } : null)
  const setupOptions = useMemo(() => [...new Set([...strategies, ...rows.map(r => r.tradeSetup), ...rows.map(r => r.setup)].filter(Boolean))], [strategies, rows])

  const cell = (r, key) => {
    const save = field => v => onSaveInput(r.id, field, v)
    switch (key) {
      case 'setup': return <SetupCell value={r.setup} options={setupOptions} onSave={save('setup')} />
      case 'riskPct': return <InputCell value={r.riskPct} width={56} placeholder="%" onSave={save('risk_pct')} />
      case 'sl': return <InputCell value={r.sl} width={76} placeholder={r.tradeSL ? String(r.tradeSL) : ''} onSave={save('stop_loss')} />
      case 'dma20': return <InputCell value={r.dma20} width={70} onSave={save('dma20')} />
      case 'dma50': return <InputCell value={r.dma50} width={70} onSave={save('dma50')} />
      case 'mae': return <InputCell value={r.mae} width={60} onSave={save('mae')} />
      case 'status': return <span style={{ fontSize:'10px', fontWeight:700, padding:'2px 6px', borderRadius:'4px', background: r.status === 'Open' ? 'var(--accent-dim)' : 'var(--surface2)', color: r.status === 'Open' ? 'var(--accent)' : 'var(--muted)' }}>{r.status}</span>
      case 'symbol': return <span style={{ fontWeight:700 }}>{r.symbol}</span>
      case 'buy': case 'netBuyPrice': return r[key] === null ? <Dash /> : toINRd(r[key])
      case 'sellPrice': case 'netSellPrice': return r[key] === null ? <Dash /> : <span title={r.live ? 'Live CMP' : undefined}>{toINRd(r[key])}{r.live && <span style={{ color:'var(--gold)', fontSize:'9px', marginLeft:'3px' }}>LIVE</span>}</span>
      case 'buyDate': case 'sellDate': return fmtDate(r[key]) || <Dash />
      case 'netBuy': case 'netSell': return r[key] === null ? <Dash /> : `₹${toINRd(r[key])}`
      case 'mtf': return r.mtf ? `₹${toINRd(r.mtf)}` : <Dash />
      case 'netPL': return r.netPL === null ? <Dash /> : <Signed v={r.netPL}>{r.netPL >= 0 ? '+' : '−'}₹{toINRd(Math.abs(r.netPL))}</Signed>
      case 'plPct': return r.plPct === null ? <Dash /> : <Signed v={r.plPct}>{pct(r.plPct)}</Signed>
      case 'slPct': return r.slPct === null ? <Dash /> : pct(r.slPct)
      case 'grossR': case 'netR': return r[key] === null ? <Dash /> : <Signed v={r[key]}>{r[key].toFixed(2)}</Signed>
      case 'qty': case 'days': return r[key] ?? <Dash />
      default: return r[key] || <Dash />
    }
  }

  const headBtn = { padding:'5px 10px', fontSize:'11px' }
  return (
    <section style={{ border:'1px solid var(--border)', borderRadius:'10px', padding:'16px', marginBottom:'22px', background:'var(--bg)' }}>
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:'10px', flexWrap:'wrap', marginBottom:'12px' }}>
        <div style={{ minWidth:0 }}>
          <div style={{ fontFamily:'Bookman Old Style, serif', fontWeight:800, fontSize:'18px', color:'var(--text)' }}>{p.name}</div>
          <div style={{ fontSize:'11px', color:'var(--muted)', fontFamily:mono, marginTop:'2px' }}>{accountsLabel || 'No accounts'}</div>
          <div style={{ display:'flex', alignItems:'center', gap:'6px', marginTop:'6px', fontSize:'11px', fontFamily:mono, color:'var(--muted)' }}>
            Portfolio size ₹ <InputCell value={p.portfolio_size} width={120} placeholder="enter size" onSave={onSaveSize} />
          </div>
        </div>
        <div style={{ display:'flex', gap:'6px', flexWrap:'wrap' }}>
          {['All','Open','Closed'].map(f => (
            <button key={f} onClick={() => setStatusFilter(f)} className={statusFilter === f ? 'btn btn-primary' : 'btn btn-ghost'} style={headBtn}>{f}</button>
          ))}
          <button onClick={onDownload} className="btn btn-ghost" style={headBtn} title="Download this portfolio as Excel (with formulas)">⬇ Excel</button>
          <button onClick={onEdit} className="btn btn-ghost" style={headBtn}>Edit</button>
          <button onClick={onDelete} className="btn btn-ghost" style={{ ...headBtn, color:'var(--bear)' }}>Delete</button>
        </div>
      </div>

      <SummaryPanel s={summary} />

      <div style={{ border:'1px solid var(--border)', borderRadius:'8px', overflowX:'auto' }}>
        <table className="data-table" style={{ tableLayout:'auto', width:'max-content', minWidth:'100%' }}>
          <thead>
            <tr>
              <th style={{ width:'28px' }} />
              {COLUMNS.map(c => (
                <th key={c.key} title={COLUMN_INFO[c.key]} onClick={() => toggleSort(c.key)} style={{ whiteSpace:'nowrap', cursor:'pointer', userSelect:'none' }}
                  className={['sr','month','account','status','symbol','setup','buyDate','sellDate'].includes(c.key) ? undefined : 'r'}>{c.label}{sort?.key === c.key ? (sort.dir === 'asc' ? ' ▲' : ' ▼') : ''}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 && (
              <tr><td colSpan={COLUMNS.length + 1} style={{ textAlign:'center', color:'var(--muted)', padding:'24px' }}>No trades</td></tr>
            )}
            {visible.map(r => (
              <tr key={r.id}>
                <td>
                  <button onClick={() => onExclude(r.id)} title="Remove this trade from this portfolio's calculations"
                    style={{ background:'none', border:'none', color:'var(--bear)', cursor:'pointer', fontSize:'13px', padding:0 }}>✕</button>
                </td>
                {COLUMNS.map(c => (
                  <td key={c.key} className={['sr','month','account','status','symbol','setup','buyDate','sellDate'].includes(c.key) ? undefined : 'num'}
                    style={{ whiteSpace:'nowrap', fontFamily:mono, fontSize:'11px' }}>
                    {c.key === 'sr' ? srNo.get(r.id) : cell(r, c.key)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {excludedRows.length > 0 && (
        <div style={{ marginTop:'10px' }}>
          <button onClick={() => setShowExcluded(s => !s)} style={{ background:'none', border:'none', color:'var(--muted)', cursor:'pointer', fontSize:'11px', fontFamily:mono, padding:0 }}>
            {showExcluded ? '▾' : '▸'} {excludedRows.length} excluded trade{excludedRows.length > 1 ? 's' : ''}
          </button>
          {showExcluded && (
            <div style={{ display:'flex', gap:'6px', flexWrap:'wrap', marginTop:'6px' }}>
              {excludedRows.map(r => (
                <span key={r.id} style={{ border:'1px solid var(--border)', borderRadius:'6px', padding:'4px 8px', fontSize:'11px', fontFamily:mono, color:'var(--muted)' }}>
                  {r.symbol} · {r.account} · {fmtDate(r.buyDate)}
                  <button onClick={() => onRestore(r.id)} style={{ marginLeft:'6px', background:'none', border:'none', color:'var(--accent)', cursor:'pointer', fontSize:'11px', padding:0 }}>Restore</button>
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  )
}

export default function RiskManagementPage() {
  const router = useRouter()
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [accounts, setAccounts] = useState([])
  const [trades, setTrades] = useState([])
  const [ownExecs, setOwnExecs] = useState([])
  const [ownFlows, setOwnFlows] = useState([])
  const [subscribers, setSubscribers] = useState([])
  const [subData, setSubData] = useState({})
  const [portfolios, setPortfolios] = useState([])
  const [inputs, setInputs] = useState({})
  const [livePrices, setLivePrices] = useState({})
  const [strategies, setStrategies] = useState([])
  const [modal, setModal] = useState(null) // { initial? }
  const [dbError, setDbError] = useState('')
  const fetchedTickers = useRef(new Set())

  const isAdmin = session?.user?.email === ADMIN
  const getToken = async () => (await supabase.auth.getSession()).data.session?.access_token

  useEffect(() => {
    supabase.auth.getSession().then(({ data:{ session } }) => { setSession(session); if (!session) router.push('/') })
    const { data:{ subscription } } = supabase.auth.onAuthStateChange((_,s) => { setSession(s); if (!s) router.push('/') })
    return () => subscription.unsubscribe()
  }, [])

  const loadData = useCallback(async () => {
    if (!session) return
    const uid = session.user.id
    const token = await getToken()
    const [{ data: aData }, { data: tData }, { data: pData, error: pErr }, { data: iData, error: iErr }, flowsRes, stratRes] = await Promise.all([
      supabase.from('accounts').select('*').eq('user_id', uid).order('name'),
      supabase.from('trades').select('*').eq('user_id', uid).order('entry_date', { ascending: true }),
      supabase.from('risk_portfolios').select('*').eq('user_id', uid).order('created_at'),
      supabase.from('risk_trade_inputs').select('*').eq('user_id', uid),
      fetch('/api/fund-flows', { headers:{ Authorization:`Bearer ${token}` } }).then(r => r.json()).catch(() => []),
      fetch('/api/strategies', { headers:{ Authorization:`Bearer ${token}` } }).then(r => r.json()).catch(() => []),
    ])
    if (pErr || iErr) setDbError((pErr || iErr).message)
    setAccounts(aData || [])
    setTrades(tData || [])
    setPortfolios(pData || [])
    setInputs(Object.fromEntries((iData || []).map(i => [i.trade_id, i])))
    setOwnFlows(Array.isArray(flowsRes) ? flowsRes : [])
    setStrategies(Array.isArray(stratRes) ? stratRes : [])
    if (tData?.length) {
      const { data: eData } = await supabase.from('executions').select('*').in('trade_id', tData.map(t => t.id)).eq('user_id', uid)
      setOwnExecs(eData || [])
    }
    setLoading(false)
  }, [session]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { if (session) loadData() }, [session, loadData])

  // Admin: every subscriber (mirrored or not) with their trades, executions, accounts and fund flows
  const loadSubscribers = useCallback(async () => {
    const token = await getToken()
    if (!token) return
    const [mirror, all] = await Promise.all([
      fetch('/api/admin/mirror', { headers:{ Authorization:`Bearer ${token}` } }).then(r => r.json()).catch(() => []),
      fetch('/api/admin/all-subscribers', { headers:{ Authorization:`Bearer ${token}` } }).then(r => r.json()).catch(() => []),
    ])
    const map = {}
    ;(Array.isArray(all) ? all : []).forEach(s => { map[s.id] = { id: s.id, name: s.name || s.email } })
    ;(Array.isArray(mirror) ? mirror : []).forEach(m => { if (!map[m.subscriber_id]) map[m.subscriber_id] = { id: m.subscriber_id, name: m.subscriber_name || m.subscriber_email } })
    delete map[session.user.id]
    const subs = Object.values(map).sort((a,b) => String(a.name).localeCompare(String(b.name)))
    setSubscribers(subs)
    subs.forEach(async s => {
      try {
        const d = await fetch(`/api/admin/subscriber-trades?user_id=${s.id}`, { headers:{ Authorization:`Bearer ${token}` } }).then(r => r.json())
        if (d.trades) setSubData(prev => ({ ...prev, [s.id]: d }))
      } catch {}
    })
  }, [session])

  useEffect(() => { if (session && isAdmin) loadSubscribers() }, [session, isAdmin, loadSubscribers])

  const ownId = session?.user?.id
  const subName = id => (subscribers.find(s => s.id === id)?.name || 'Subscriber').split(' ')[0]

  // Every account that can go into a portfolio
  const accountOptions = useMemo(() => {
    if (!ownId) return []
    const opts = []
    const ownNames = [...new Set([...accounts.map(a => a.name), ...trades.map(t => t.account).filter(Boolean)])]
    ownNames.forEach(a => opts.push({ group:'My accounts', owner_id: ownId, account: a, tradeCount: trades.filter(t => t.account === a).length }))
    subscribers.forEach(s => {
      const d = subData[s.id]
      if (!d) return
      const names = [...new Set([...(d.accounts || []).map(a => a.name), ...(d.trades || []).map(t => t.account).filter(Boolean)])]
      names.forEach(a => opts.push({ group: s.name, owner_id: s.id, account: a, tradeCount: d.trades.filter(t => t.account === a).length }))
    })
    return opts
  }, [ownId, accounts, trades, subscribers, subData])

  const execsByTrade = useMemo(() => {
    const m = {}
    const add = e => { (m[e.trade_id] = m[e.trade_id] || []).push(e) }
    ownExecs.forEach(add)
    Object.values(subData).forEach(d => (d.executions || []).forEach(add))
    return m
  }, [ownExecs, subData])

  const memberTrades = useCallback(m => {
    const list = m.owner_id === ownId ? trades : (subData[m.owner_id]?.trades || [])
    const label = m.owner_id === ownId ? m.account : `${subName(m.owner_id)} · ${m.account}`
    return list.filter(t => t.account === m.account).map(t => ({ ...t, _accountLabel: label }))
  }, [ownId, trades, subData, subscribers]) // eslint-disable-line react-hooks/exhaustive-deps

  // Capital for one account = net deposits + realised P/L of its closed trades
  const memberCapital = useCallback(m => {
    const flows = m.owner_id === ownId ? ownFlows : (subData[m.owner_id]?.fund_flows || [])
    const net = flows.filter(f => f.account_name === m.account).reduce((s,f) => s + (f.type === 'ADD' ? 1 : f.type === 'WITHDRAW' ? -1 : 0) * Number(f.amount), 0)
    const realised = memberTrades(m).filter(t => t.status === 'CLOSED').reduce((s,t) => {
      const ex = execsByTrade[t.id] || []
      return s + (ex.length ? ex.reduce((a,e) => a + (Number(e.price) - Number(t.entry_price)) * Number(e.quantity), 0) : (Number(t.realized_gains) || 0))
    }, 0)
    return net + realised
  }, [ownId, ownFlows, subData, memberTrades, execsByTrade])

  // Live prices for open trades shown in any portfolio
  useEffect(() => {
    const tickers = new Set()
    portfolios.forEach(p => (p.members || []).forEach(m => memberTrades(m).forEach(t => { if (t.status !== 'CLOSED') tickers.add(t.ticker) })))
    tickers.forEach(async ticker => {
      if (fetchedTickers.current.has(ticker)) return
      fetchedTickers.current.add(ticker)
      try {
        const d = await fetch(`/api/stock/${ticker}`).then(r => r.json())
        if (d.price) setLivePrices(prev => ({ ...prev, [ticker]: d.price }))
      } catch {}
    })
  }, [portfolios, memberTrades])

  const portfolioData = useMemo(() => {
    const out = {}
    portfolios.forEach(p => {
      const members = p.members || []
      const excluded = new Set(p.excluded_trade_ids || [])
      const seen = new Set()
      const all = []
      members.forEach(m => memberTrades(m).forEach(t => { if (!seen.has(t.id) && String(t.entry_date).slice(0,10) >= START_DATE) { seen.add(t.id); all.push(t) } }))
      all.sort((a,b) => String(a.entry_date).localeCompare(String(b.entry_date)) || String(a.created_at).localeCompare(String(b.created_at)))
      const build = t => buildRow(t, execsByTrade[t.id] || [], inputs[t.id], livePrices[t.ticker])
      const rows = all.filter(t => !excluded.has(t.id)).map(build)
      const excludedRows = all.filter(t => excluded.has(t.id)).map(build)
      // Portfolio Size, when entered, is the capital; otherwise fall back to net deposits + realised P/L
      const capital = Number(p.portfolio_size) > 0 ? Number(p.portfolio_size) : members.reduce((s,m) => s + memberCapital(m), 0)
      const accountsLabel = members.map(m => m.owner_id === ownId ? m.account : `${subName(m.owner_id)} · ${m.account}`).join(', ')
      out[p.id] = { rows, excludedRows, summary: summarize(rows, capital), accountsLabel }
    })
    return out
  }, [portfolios, memberTrades, execsByTrade, inputs, livePrices, memberCapital, ownId]) // eslint-disable-line react-hooks/exhaustive-deps

  const savePortfolio = async ({ name, members, portfolio_size }, existing) => {
    if (existing) {
      const { data, error } = await supabase.from('risk_portfolios').update({ name, members, portfolio_size }).eq('id', existing.id).select().single()
      if (error) throw error
      setPortfolios(ps => ps.map(p => p.id === existing.id ? data : p))
    } else {
      const { data, error } = await supabase.from('risk_portfolios').insert([{ user_id: ownId, name, members, portfolio_size }]).select().single()
      if (error) throw error
      setPortfolios(ps => [...ps, data])
    }
  }

  const deletePortfolio = async p => {
    if (!window.confirm(`Delete portfolio "${p.name}"?\n\nTrades and the values you entered are kept; only this grouping is removed.`)) return
    const { error } = await supabase.from('risk_portfolios').delete().eq('id', p.id)
    if (error) { alert('Error: ' + error.message); return }
    setPortfolios(ps => ps.filter(x => x.id !== p.id))
  }

  const setExcluded = async (p, ids) => {
    const prev = portfolios
    setPortfolios(ps => ps.map(x => x.id === p.id ? { ...x, excluded_trade_ids: ids } : x))
    const { error } = await supabase.from('risk_portfolios').update({ excluded_trade_ids: ids }).eq('id', p.id)
    if (error) { setPortfolios(prev); alert('Error: ' + error.message) }
  }

  const saveInput = async (tradeId, field, value) => {
    const row = { ...(inputs[tradeId] || {}), user_id: ownId, trade_id: tradeId, [field]: value, updated_at: new Date().toISOString() }
    const prev = inputs
    setInputs(m => ({ ...m, [tradeId]: row }))
    const { error } = await supabase.from('risk_trade_inputs').upsert(row, { onConflict: 'user_id,trade_id' })
    if (error) { setInputs(prev); alert('Could not save: ' + error.message) }
  }

  const download = (list, filename) => {
    const items = list.map(p => ({ portfolio: { name: p.name, accountsLabel: portfolioData[p.id]?.accountsLabel || '', size: Number(p.portfolio_size) > 0 ? Number(p.portfolio_size) : null }, rows: portfolioData[p.id]?.rows || [], summary: portfolioData[p.id]?.summary }))
    downloadRiskWorkbook(items, filename).catch(e => alert('Export failed: ' + e.message))
  }

  const signOut = async () => { await supabase.auth.signOut(); window.location.href = '/' }

  if (!session) return null

  const stamp = new Date().toISOString().slice(0,10)
  return (
    <>
      <div className="tricolor-bar" />
      <Head><title>Risk Management — SMK Stock Journal</title></Head>
      <Sidebar active="Risk Management" isAdmin={isAdmin} user={session?.user} onSignOut={signOut} />

      <main className="sidebar-offset" style={{ padding:'28px 32px 40px' }}>
        <div style={{ display:'flex', alignItems:'flex-end', justifyContent:'space-between', gap:'12px', flexWrap:'wrap', marginBottom:'20px' }}>
          <div>
            <h1 style={{ fontFamily:'Bookman Old Style, serif', fontWeight:800, fontSize:'24px', color:'var(--text)', margin:0 }}>Risk Management</h1>
            <div style={{ fontSize:'11px', color:'var(--muted)', marginTop:'4px', fontFamily:mono }}>R-multiples, heat and setup stats per portfolio of accounts · trades bought from {fmtDate(START_DATE)}</div>
          </div>
          <div style={{ display:'flex', gap:'8px' }}>
            {portfolios.length > 0 && (
              <button onClick={() => download(portfolios, `Risk-Management-All-${stamp}.xlsx`)} className="btn btn-ghost">⬇ Download all (Excel)</button>
            )}
            <button onClick={() => setModal({})} className="btn btn-primary" disabled={!!dbError}>+ Portfolio</button>
          </div>
        </div>

                {dbError ? (
          <div style={{ border:'1px solid var(--bear)', borderRadius:'8px', padding:'16px', color:'var(--bear)', fontSize:'12px', fontFamily:mono }}>
            Risk Management tables are not set up yet ({dbError}). Run <b>supabase-risk-management.sql</b> in the Supabase SQL editor.
          </div>
        ) : loading ? (
          <div style={{ textAlign:'center', padding:'60px', color:'var(--muted)' }}>Loading...</div>
        ) : portfolios.length === 0 ? (
          <div style={{ textAlign:'center', padding:'80px', color:'var(--muted)' }}>
            No portfolios yet. Click <b>+ Portfolio</b> to group one or more accounts.
          </div>
        ) : portfolios.map(p => (
          <PortfolioSection key={p.id} p={p} data={portfolioData[p.id]} strategies={strategies}
            onEdit={() => setModal({ initial: p })}
            onDelete={() => deletePortfolio(p)}
            onDownload={() => download([p], `Risk-${p.name.replace(/[^\w-]+/g, '_')}-${stamp}.xlsx`)}
            onExclude={id => setExcluded(p, [...new Set([...(p.excluded_trade_ids || []), id])])}
            onRestore={id => setExcluded(p, (p.excluded_trade_ids || []).filter(x => x !== id))}
            onSaveInput={saveInput}
            onSaveSize={async v => {
              const { data, error } = await supabase.from('risk_portfolios').update({ portfolio_size: v }).eq('id', p.id).select().single()
              if (error) { alert('Could not save: ' + error.message); return }
              setPortfolios(ps => ps.map(x => x.id === p.id ? data : x))
            }} />
        ))}
      </main>

      {modal && (
        <PortfolioModal initial={modal.initial} options={accountOptions} onClose={() => setModal(null)}
          onSave={vals => savePortfolio(vals, modal.initial)} />
      )}
    </>
  )
}
