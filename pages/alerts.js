import React, { useState, useEffect, useCallback } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'
import { supabase } from '../lib/supabase'
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



const ADMIN_EMAIL = 'gogoaheadgo@gmail.com'

function AddAlertModal({ onClose, onAdd }) {
  const [ticker, setTicker] = useState('')
  const [validity, setValidity] = useState('1')
  const [aboveTg1, setAboveTg1] = useState('')
  const [aboveTg2, setAboveTg2] = useState('')
  const [belowTg1, setBelowTg1] = useState('')
  const [belowTg2, setBelowTg2] = useState('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [suggestions, setSuggestions] = useState([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [searchLoading, setSearchLoading] = useState(false)

  const searchTicker = async (query) => {
    setTicker(query.toUpperCase())
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
    setTicker(item.ticker)
    setSuggestions([])
    setShowSuggestions(false)
  }

  const handleSave = async () => {
    if (!ticker.trim()) { setError('Ticker is required'); return }
    if (!aboveTg1 && !aboveTg2 && !belowTg1 && !belowTg2) { setError('Enter at least one target price'); return }
    setSaving(true); setError('')
    try {
      await onAdd({ ticker: ticker.trim().toUpperCase(), validity_months: validity, above_tg1: aboveTg1, above_tg2: aboveTg2, below_tg1: belowTg1, below_tg2: belowTg2, note })
      onClose()
    } catch (e) { setError(e.message) }
    setSaving(false)
  }

  const inp = { background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '6px', padding: '8px 10px', color: 'var(--text)', fontSize: '13px', fontFamily: 'DM Mono, monospace', width: '100%', boxSizing: 'border-box' }
  const lbl = { fontSize: '9px', color: 'var(--muted)', fontFamily: 'DM Mono, monospace', letterSpacing: '0.12em', marginBottom: '4px' }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.72)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '14px', padding: '26px', width: '400px', boxShadow: '0 24px 64px rgba(0,0,0,0.5)', maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ fontFamily: 'Bookman Old Style, serif', fontWeight: 700, fontSize: '16px', color: 'var(--text)', marginBottom: '20px' }}>🔔 Set Price Alert</div>

        {/* Ticker */}
        <div style={{ marginBottom: '14px', position: 'relative' }}>
          <div style={lbl}>TICKER {searchLoading && <span style={{ color: 'var(--accent)', fontWeight: 400 }}>searching...</span>}</div>
          <input
            value={ticker}
            onChange={e => searchTicker(e.target.value)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
            onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
            placeholder="e.g. RELIANCE, TCS..."
            style={{ ...inp, textTransform: 'uppercase' }}
            autoComplete="off"
          />
          {showSuggestions && suggestions.length > 0 && (
            <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 999, background: 'var(--bg)', border: '1px solid var(--accent)', borderRadius: '6px', boxShadow: '0 8px 24px rgba(0,0,0,0.2)', maxHeight: '200px', overflowY: 'auto', marginTop: '2px' }}>
              {suggestions.map((item, i) => (
                <div key={i} onMouseDown={() => selectTicker(item)}
                  style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--surface)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <div>
                    <div style={{ fontFamily: 'DM Mono, monospace', fontWeight: 700, fontSize: '13px', color: 'var(--accent)' }}>{item.ticker}</div>
                    <div style={{ fontSize: '10px', color: 'var(--muted)', marginTop: '1px' }}>{item.shortName}</div>
                  </div>
                  <div style={{ fontSize: '10px', fontFamily: 'DM Mono, monospace', color: 'var(--muted)', background: 'var(--surface)', padding: '2px 6px', borderRadius: '3px' }}>{item.exchange}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Validity */}
        <div style={{ marginBottom: '16px' }}>
          <div style={lbl}>VALIDITY PERIOD</div>
          <div style={{ display: 'flex', gap: '8px' }}>
            {[{ v: '1', label: '1 Month' }, { v: '3', label: '3 Months' }].map(({ v, label }) => (
              <button key={v} onClick={() => setValidity(v)} style={{
                flex: 1, padding: '9px', border: `2px solid ${validity === v ? 'var(--accent)' : 'var(--border)'}`,
                background: validity === v ? 'var(--accent-dim)' : 'transparent',
                borderRadius: '6px', cursor: 'pointer', fontFamily: 'DM Mono, monospace',
                fontWeight: 700, fontSize: '12px', color: validity === v ? 'var(--accent)' : 'var(--muted)',
              }}>{label}</button>
            ))}
          </div>
        </div>

        {/* Above targets */}
        <div style={{ background: 'rgba(34,197,94,0.05)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: '8px', padding: '12px', marginBottom: '12px' }}>
          <div style={{ fontSize: '10px', color: '#22c55e', fontFamily: 'DM Mono, monospace', fontWeight: 700, marginBottom: '10px', letterSpacing: '0.1em' }}>↑ ABOVE CMP TARGETS</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div>
              <div style={{ ...lbl, color: '#22c55e' }}>TARGET 1 (Rs.)</div>
              <input type="number" value={aboveTg1} onChange={e => setAboveTg1(e.target.value)} placeholder="Optional" style={{ ...inp, borderColor: aboveTg1 ? '#22c55e' : 'var(--border)' }} />
            </div>
            <div>
              <div style={{ ...lbl, color: '#22c55e' }}>TARGET 2 (Rs.)</div>
              <input type="number" value={aboveTg2} onChange={e => setAboveTg2(e.target.value)} placeholder="Optional" style={{ ...inp, borderColor: aboveTg2 ? '#22c55e' : 'var(--border)' }} />
            </div>
          </div>
        </div>

        {/* Below targets */}
        <div style={{ background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '8px', padding: '12px', marginBottom: '14px' }}>
          <div style={{ fontSize: '10px', color: '#ef4444', fontFamily: 'DM Mono, monospace', fontWeight: 700, marginBottom: '10px', letterSpacing: '0.1em' }}>↓ BELOW CMP TARGETS</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div>
              <div style={{ ...lbl, color: '#ef4444' }}>TARGET 1 (Rs.)</div>
              <input type="number" value={belowTg1} onChange={e => setBelowTg1(e.target.value)} placeholder="Optional" style={{ ...inp, borderColor: belowTg1 ? '#ef4444' : 'var(--border)' }} />
            </div>
            <div>
              <div style={{ ...lbl, color: '#ef4444' }}>TARGET 2 (Rs.)</div>
              <input type="number" value={belowTg2} onChange={e => setBelowTg2(e.target.value)} placeholder="Optional" style={{ ...inp, borderColor: belowTg2 ? '#ef4444' : 'var(--border)' }} />
            </div>
          </div>
        </div>

        {/* Note */}
        <div style={{ marginBottom: '16px' }}>
          <div style={lbl}>NOTE (optional)</div>
          <input value={note} onChange={e => setNote(e.target.value)} placeholder="e.g. Breakout setup" style={inp} />
        </div>

        {error && <div style={{ color: 'var(--bear)', fontSize: '12px', fontFamily: 'DM Mono, monospace', marginBottom: '12px' }}>{error}</div>}

        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={handleSave} disabled={saving} style={{
            flex: 1, padding: '11px', background: 'var(--accent)', color: '#fff', border: 'none',
            borderRadius: '7px', cursor: 'pointer', fontFamily: 'DM Mono, monospace', fontWeight: 700,
            fontSize: '13px', opacity: saving ? 0.6 : 1,
          }}>{saving ? 'Saving...' : 'Set Alert'}</button>
          <button onClick={onClose} style={{
            flex: 1, padding: '11px', background: 'none', border: '1px solid var(--border)',
            color: 'var(--muted)', borderRadius: '7px', cursor: 'pointer', fontFamily: 'DM Mono, monospace', fontSize: '12px',
          }}>Cancel</button>
        </div>
      </div>
    </div>
  )
}

export default function AlertsPage() {
  const router = useRouter()
  const [session, setSession] = useState(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [alerts, setAlerts] = useState([])
  const [loading, setLoading] = useState(false)
  const [showAdd, setShowAdd] = useState(false)
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [livePrices, setLivePrices] = useState({})
  const [sortCol, setSortCol] = useState(null)
  const [sortDir, setSortDir] = useState('asc')
  const [slTrades, setSlTrades] = useState([])

  const getToken = useCallback(async () => (await supabase.auth.getSession()).data.session?.access_token, [])

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      if (!s) { router.push('/'); return }
      setSession(s); setIsAdmin(s.user.email === ADMIN_EMAIL)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, s) => { if (!s) router.push('/') })
    return () => subscription.unsubscribe()
  }, []) // eslint-disable-line

  const loadAlerts = useCallback(async (silent = false) => {
    const token = await getToken()
    if (!token) return
    setLoading(true)
    const res = await fetch('/api/price-alerts', { headers: { Authorization: `Bearer ${token}` } })
    const data = await res.json()
    if (Array.isArray(data)) setAlerts(data)
    // Also load open trades with stop loss
    const slRes = await fetch('/api/trades', { headers: { Authorization: `Bearer ${token}` } })
    const slData = await slRes.json()
    if (Array.isArray(slData)) setSlTrades(slData.filter(t => t.stop_loss && t.status === 'OPEN'))
    setLoading(false)
  }, [getToken])

  useEffect(() => { if (session) loadAlerts() }, [session, loadAlerts])

  // Silent refresh on tab focus
  useEffect(() => {
    const _onFocus = () => { if (session) loadAlerts(true) }
    window.addEventListener('focus', _onFocus)
    return () => window.removeEventListener('focus', _onFocus)
  }, [session]) // eslint-disable-line

  useEffect(() => {
    const tickers = [...new Set(alerts.filter(a => a.status === 'ACTIVE').map(a => a.ticker))]
    // Also fetch prices for SL trade tickers
    const slTickers = [...new Set(slTrades.map(t => t.ticker))]
    ;[...tickers, ...slTickers].forEach(async ticker => {
      try {
        const r = await fetch(`/api/stock/${ticker}`)
        const d = await r.json()
        if (d.price) setLivePrices(p => ({ ...p, [ticker]: d.price }))
      } catch {}
    })
  }, [alerts])

  const handleAdd = async (form) => {
    const token = await getToken()
    const res = await fetch('/api/price-alerts', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(form),
    })
    const data = await res.json()
    if (data.error) throw new Error(data.error)
    await loadAlerts()
  }

  const handleDelete = async (id) => {
    if (!confirm('🗑 Delete this alert?\n\nThis alert will be permanently removed.')) return
    if (!confirm('⚠️ CONFIRM DELETE\n\nAre you sure? This cannot be undone.')) return
    const token = await getToken()
    await fetch('/api/price-alerts', { method: 'DELETE', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ id }) })
    await loadAlerts()
  }

  const handleToggle = async (id, current) => {
    const token = await getToken()
    await fetch('/api/price-alerts', { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ id, status: current === 'ACTIVE' ? 'PAUSED' : 'ACTIVE' }) })
    await loadAlerts()
  }

  const handleReset = async (id) => {
    const token = await getToken()
    // Reset triggered_targets too via a direct update - use PUT with special flag
    await fetch('/api/price-alerts', { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ id, status: 'ACTIVE' }) })
    await loadAlerts()
  }

  const doSort = (col) => { if(sortCol===col) setSortDir(d=>d==='asc'?'desc':'asc'); else { setSortCol(col); setSortDir('asc') } }
  const sortIcon = (col) => sortCol===col ? (sortDir==='asc'?' ↑':' ↓') : ' ↕'
  const applySort = (list) => {
    if (!sortCol) return list
    return [...list].sort((a,b) => {
      let av=a[sortCol], bv=b[sortCol]
      if (av==null) av=sortDir==='asc'?'zzz':''; if (bv==null) bv=sortDir==='asc'?'zzz':''
      if (typeof av==='string') av=av.toLowerCase(), bv=bv.toLowerCase()
      return sortDir==='asc'?(av>bv?1:-1):(av<bv?1:-1)
    })
  }
  const downloadCSV = (list) => {
    const headers = ['Ticker','Above TG1','Above TG2','Below TG1','Below TG2','Alert Date','Valid Till','Status']
    const rows = list.map(a=>[a.ticker,a.above_tg1||'',a.above_tg2||'',a.below_tg1||'',a.below_tg2||'',a.alert_date,a.valid_till,a.status])
    const csv=[headers,...rows].map(r=>r.join(',')).join('\n')
    triggerCSVDownload(csv, 'alerts.csv')
  }
  const signOut = async () => { await supabase.auth.signOut(); window.location.href = '/' }

  const toINRd = n => n != null ? Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : null
  const fmt = n => n != null ? `\${toINRd(n)}` : '—'

  const filtered = statusFilter === 'ALL' ? alerts : alerts.filter(a => a.status === statusFilter)
  const counts = {
    ACTIVE: alerts.filter(a => a.status === 'ACTIVE').length,
    TRIGGERED: alerts.filter(a => a.status === 'TRIGGERED').length,
    PAUSED: alerts.filter(a => a.status === 'PAUSED').length,
  }

  const isExpired = (a) => a.valid_till && new Date(a.valid_till) < new Date()

  if (!session) return null

  return (
    <>
      <Head><title>Price Alerts — CHiiRAG Stock Journal</title></Head>
      <div className="tricolor-bar" />
      <header className="header" style={{ top: '4px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div className="india-flag-logo-sm" style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ flex: 1, background: '#FF9933' }} />
            <div style={{ flex: 1, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', border: '1.5px solid #000080' }} />
            </div>
            <div style={{ flex: 1, background: '#138808' }} />
          </div>
          <div style={{ fontFamily: 'Bookman Old Style, serif', fontWeight: 800, fontSize: '15px', color: 'var(--text)' }}>
            CHiiRAG <span style={{ color: 'var(--accent)' }}>STOCK Journal</span>
          </div>
        </div>
        <NavPill active="Alerts" isAdmin={isAdmin} />
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button onClick={signOut} className="btn btn-ghost" style={{ padding: '6px 10px', fontSize: '11px' }}>Sign Out</button>
        </div>
      </header>

      <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '80px 16px 40px' }}>

        {/* Page header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h1 style={{ fontFamily: 'Bookman Old Style, serif', fontSize: '22px', fontWeight: 800, color: 'var(--text)', margin: 0 }}>🔔 Price Alerts</h1>
            <p style={{ color: 'var(--muted)', fontSize: '12px', marginTop: '6px', fontFamily: 'DM Mono, monospace' }}>
              Email notification when stock crosses your target · checked every 15 min
            </p>
          </div>
          <button onClick={() => setShowAdd(true)} className="btn btn-primary" style={{ padding: '9px 20px', fontSize: '12px' }}>+ New Alert</button>
        </div>

        {/* Stat tiles */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '10px', marginBottom: '18px' }}>
          {[
            { label: 'Active', key: 'ACTIVE', color: 'var(--bull)', bg: 'rgba(0,230,118,0.06)' },
            { label: 'Triggered', key: 'TRIGGERED', color: 'var(--accent)', bg: 'var(--accent-dim)' },
            { label: 'Paused', key: 'PAUSED', color: 'var(--muted)', bg: 'var(--surface)' },
          ].map(s => (
            <div key={s.key} onClick={() => setStatusFilter(s.key)}
              style={{ background: s.bg, border: `1px solid ${statusFilter === s.key ? s.color : 'var(--border)'}`, borderRadius: '8px', padding: '12px 16px', cursor: 'pointer' }}>
              <div style={{ fontSize: '9px', color: 'var(--muted)', fontFamily: 'DM Mono, monospace', marginBottom: '4px', letterSpacing: '0.1em' }}>{s.label.toUpperCase()} ALERTS</div>
              <div style={{ fontSize: '22px', fontWeight: 800, fontFamily: 'DM Mono, monospace', color: s.color }}>{counts[s.key]}</div>
            </div>
          ))}
        </div>

        {/* Filter tabs */}
        <div style={{ display: 'flex', gap: '6px', marginBottom: '14px' }}>
          <button onClick={() => downloadCSV(filtered)}
            style={{ padding:'5px 12px', background:'var(--surface)', border:'1px solid var(--border)', color:'var(--muted)', borderRadius:'4px', cursor:'pointer', fontSize:'10px', fontFamily:'DM Mono, monospace', marginRight:'6px' }}>
            ⬇ CSV
          </button>
          {['ALL', 'ACTIVE', 'TRIGGERED', 'PAUSED'].map(f => (
            <button key={f} onClick={() => setStatusFilter(f)} style={{
              padding: '5px 14px', borderRadius: '4px', cursor: 'pointer', fontSize: '10px',
              fontFamily: 'DM Mono, monospace', fontWeight: 600,
              border: `1px solid ${statusFilter === f ? 'var(--accent)' : 'var(--border)'}`,
              background: statusFilter === f ? 'var(--accent-dim)' : 'transparent',
              color: statusFilter === f ? 'var(--accent)' : 'var(--muted)',
            }}>
              {f} ({f === 'ALL' ? alerts.length : counts[f] || 0})
            </button>
          ))}
        </div>

        {/* Alerts table */}
        {loading ? (
          <div style={{ color: 'var(--muted)', padding: '40px', textAlign: 'center' }}>Loading...</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px', border: '1px dashed var(--border)', borderRadius: '10px' }}>
            <div style={{ fontSize: '32px', marginBottom: '12px' }}>🔔</div>
            <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '13px', color: 'var(--muted)', marginBottom: '16px' }}>No alerts yet.</div>
            <button onClick={() => setShowAdd(true)} className="btn btn-primary" style={{ padding: '9px 20px', fontSize: '12px' }}>+ New Alert</button>
          </div>
        ) : (
          <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: '10px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', fontFamily: 'DM Mono, monospace' }}>
              <thead>
                <tr style={{ background: 'var(--surface)', borderBottom: '2px solid var(--border)' }}>
                  {[['ticker','STOCK','left'],['','CMP','right'],['above_tg1','↑ TG1','right'],['above_tg2','↑ TG2','right'],['below_tg1','↓ TG1','right'],['below_tg2','↓ TG2','right'],['','NEXT %','right'],['alert_date','ALERT DATE','center'],['valid_till','VALID TILL','center'],['status','STATUS','center'],['','ACTION','center']].map(([col,label,align],i) => (
                    <th key={i} onClick={() => col && doSort(col)} style={{ padding:'11px 14px', textAlign:align, color:i>=2&&i<=3?'#22c55e':i>=4&&i<=5?'#ef4444':i===6?'var(--gold)':'var(--muted)', fontWeight:i>=2&&i<=6?700:600, fontSize:'10px', letterSpacing:'0.1em', cursor:col?'pointer':'default', userSelect:'none', whiteSpace:'nowrap' }}>
                      {label}{col?sortIcon(col):''}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {applySort(filtered).map((alert, idx) => {
                  const cmp = livePrices[alert.ticker]
                  const expired = isExpired(alert)
                  const triggered = alert.triggered_targets || []
                  const statusColor = alert.status === 'ACTIVE' ? 'var(--bull)' : alert.status === 'TRIGGERED' ? 'var(--accent)' : 'var(--muted)'

                  const tgCell = (val, key, isAbove) => {
                    if (!val) return <td style={{ padding: '10px 14px', textAlign: 'right', color: 'var(--muted)', borderBottom: '1px solid var(--border)' }}>—</td>
                    const hit = triggered.includes(key)
                    const baseColor = isAbove ? '#22c55e' : '#ef4444'
                    return (
                      <td style={{ padding: '10px 14px', textAlign: 'right', borderBottom: '1px solid var(--border)', background: hit ? (isAbove ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)') : 'transparent' }}>
                        <span style={{ color: hit ? baseColor : baseColor, fontWeight: hit ? 800 : 600, fontSize: '12px' }}>
                          Rs.{toINRd(val)}
                          {hit && <span style={{ marginLeft: '4px', fontSize: '10px' }}>✓</span>}
                        </span>
                      </td>
                    )
                  }

                  return (
                    <tr key={alert.id} style={{ background: idx % 2 === 0 ? 'var(--bg)' : 'var(--surface)', opacity: alert.status === 'PAUSED' ? 0.55 : 1 }}>
                      {/* Stock */}
                      <td style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)' }}>
                        <div style={{ fontWeight: 800, fontSize: '13px', color: 'var(--text)' }}>{alert.ticker}</div>
                        {alert.note && <div style={{ fontSize: '10px', color: 'var(--muted)', marginTop: '2px' }}>📝 {alert.note}</div>}
                      </td>
                      {/* CMP */}
                      <td style={{ padding: '10px 14px', textAlign: 'right', borderBottom: '1px solid var(--border)' }}>
                        {cmp ? <span style={{ fontWeight: 700, color: 'var(--text)' }}>\{toINRd(cmp)}</span> : <span style={{ color: 'var(--muted)' }}>—</span>}
                      </td>
                      {/* Above TG1 */}
                      {tgCell(alert.above_tg1, 'above_tg1', true)}
                      {/* Above TG2 */}
                      {tgCell(alert.above_tg2, 'above_tg2', true)}
                      {/* Below TG1 */}
                      {tgCell(alert.below_tg1, 'below_tg1', false)}
                      {/* Below TG2 */}
                      {tgCell(alert.below_tg2, 'below_tg2', false)}
                      {/* Next Target % */}
                      {(() => {
                        if (!cmp) return <td style={{ padding:'10px 14px', textAlign:'right', color:'var(--muted)', borderBottom:'1px solid var(--border)' }}>—</td>
                        // Find next untriggered target closest to CMP
                        const allTargets = [
                          { val: alert.above_tg1, key: 'above_tg1' },
                          { val: alert.above_tg2, key: 'above_tg2' },
                          { val: alert.below_tg1, key: 'below_tg1' },
                          { val: alert.below_tg2, key: 'below_tg2' },
                        ].filter(t => t.val && !triggered.includes(t.key))
                        if (!allTargets.length) return <td style={{ padding:'10px 14px', textAlign:'right', color:'var(--muted)', borderBottom:'1px solid var(--border)' }}>—</td>
                        // Pick closest to CMP
                        const next = allTargets.reduce((a, b) => Math.abs(a.val - cmp) < Math.abs(b.val - cmp) ? a : b)
                        const pct = ((next.val - cmp) * 100 / cmp)
                        const isUp = pct >= 0
                        return (
                          <td style={{ padding:'10px 14px', textAlign:'right', borderBottom:'1px solid var(--border)' }}>
                            <span style={{ fontWeight:700, fontSize:'12px', fontFamily:'DM Mono, monospace', color: isUp ? '#22c55e' : '#ef4444' }}>
                              {isUp ? '+' : ''}{pct.toFixed(2)}%
                            </span>
                            <div style={{ fontSize:'9px', color:'var(--muted)', marginTop:'1px' }}>{Number(next.val).toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2})}</div>
                          </td>
                        )
                      })()}
                      {/* Alert Date */}
                      <td style={{ padding: '10px 14px', textAlign: 'center', color: 'var(--muted)', borderBottom: '1px solid var(--border)', fontSize: '11px' }}>
                        {alert.alert_date ? new Date(alert.alert_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                      </td>
                      {/* Valid Till */}
                      <td style={{ padding: '10px 14px', textAlign: 'center', borderBottom: '1px solid var(--border)', fontSize: '11px' }}>
                        <span style={{ color: expired ? 'var(--bear)' : 'var(--bull)', fontWeight: expired ? 700 : 400 }}>
                          {alert.valid_till ? new Date(alert.valid_till).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                        </span>
                        {expired && <div style={{ fontSize: '9px', color: 'var(--bear)', marginTop: '2px' }}>EXPIRED</div>}
                      </td>
                      {/* Status */}
                      <td style={{ padding: '10px 14px', textAlign: 'center', borderBottom: '1px solid var(--border)' }}>
                        <span style={{ fontSize: '10px', fontWeight: 700, color: statusColor, background: alert.status === 'ACTIVE' ? 'rgba(0,230,118,0.08)' : alert.status === 'TRIGGERED' ? 'var(--accent-dim)' : 'var(--surface)', padding: '3px 8px', borderRadius: '4px' }}>
                          {alert.status}
                        </span>
                      </td>
                      {/* Actions */}
                      <td style={{ padding: '10px 14px', textAlign: 'center', borderBottom: '1px solid var(--border)' }}>
                        <div style={{ display: 'flex', gap: '5px', justifyContent: 'center' }}>
                          {alert.status === 'TRIGGERED' && (
                            <button onClick={() => handleReset(alert.id)} style={{ padding: '4px 8px', background: 'var(--accent-dim)', border: '1px solid var(--accent)', color: 'var(--accent)', borderRadius: '4px', cursor: 'pointer', fontSize: '9px', fontFamily: 'DM Mono, monospace', fontWeight: 700 }}>↺</button>
                          )}
                          {(alert.status === 'ACTIVE' || alert.status === 'PAUSED') && (
                            <button onClick={() => handleToggle(alert.id, alert.status)} style={{ padding: '4px 8px', background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--muted)', borderRadius: '4px', cursor: 'pointer', fontSize: '10px' }}>
                              {alert.status === 'ACTIVE' ? '⏸' : '▶'}
                            </button>
                          )}
                          <button onClick={() => handleDelete(alert.id)} style={{ padding: '4px 8px', background: 'none', border: '1px solid var(--border)', color: 'var(--bear)', borderRadius: '4px', cursor: 'pointer', fontSize: '11px' }}>🗑</button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* ── STOP LOSS TRADES SECTION ── */}
        {slTrades.length > 0 && (
          <div style={{ marginTop: '32px' }}>
            <div style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'14px' }}>
              <h2 style={{ fontFamily:'Bookman Old Style, serif', fontSize:'17px', fontWeight:700, margin:0, color:'var(--text)' }}>🚨 Stop Loss Monitor</h2>
              <span style={{ fontSize:'10px', background:'rgba(239,68,68,0.1)', color:'var(--bear)', padding:'2px 8px', borderRadius:'4px', fontFamily:'DM Mono, monospace', fontWeight:700 }}>OPEN TRADES WITH SL</span>
            </div>
            <div style={{ overflowX:'auto', border:'1px solid var(--border)', borderRadius:'10px' }}>
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'12px', fontFamily:'DM Mono, monospace' }}>
                <thead>
                  <tr style={{ background:'var(--surface)', borderBottom:'2px solid var(--border)' }}>
                    <th style={{ padding:'10px 14px', textAlign:'left', color:'var(--muted)', fontSize:'10px', letterSpacing:'0.1em' }}>STOCK</th>
                    <th style={{ padding:'10px 14px', textAlign:'left', color:'var(--muted)', fontSize:'10px', letterSpacing:'0.1em' }}>ACCOUNT</th>
                    <th style={{ padding:'10px 14px', textAlign:'right', color:'var(--muted)', fontSize:'10px', letterSpacing:'0.1em' }}>BUY PRICE</th>
                    <th style={{ padding:'10px 14px', textAlign:'right', color:'var(--muted)', fontSize:'10px', letterSpacing:'0.1em' }}>CMP</th>
                    <th style={{ padding:'10px 14px', textAlign:'right', color:'var(--bear)', fontSize:'10px', letterSpacing:'0.1em', fontWeight:700 }}>STOP LOSS</th>
                    <th style={{ padding:'10px 14px', textAlign:'right', color:'var(--bear)', fontSize:'10px', letterSpacing:'0.1em', fontWeight:700 }}>SL %</th>
                    <th style={{ padding:'10px 14px', textAlign:'right', color:'var(--muted)', fontSize:'10px', letterSpacing:'0.1em' }}>DISTANCE</th>
                  </tr>
                </thead>
                <tbody>
                  {slTrades.map((trade, idx) => {
                    const cmp = livePrices[trade.ticker]
                    const slPct = ((trade.stop_loss - trade.entry_price) / trade.entry_price * 100)
                    const dist = cmp ? ((cmp - trade.stop_loss) / trade.stop_loss * 100) : null
                    const isNear = dist !== null && dist < 3
                    const isHit = dist !== null && dist <= 0
                    return (
                      <tr key={trade.id} style={{ background: isHit ? 'rgba(239,68,68,0.08)' : isNear ? 'rgba(239,68,68,0.04)' : idx%2===0?'var(--bg)':'var(--surface)', borderLeft: isHit ? '3px solid var(--bear)' : isNear ? '3px solid rgba(239,68,68,0.4)' : '3px solid transparent' }}>
                        <td style={{ padding:'10px 14px', borderBottom:'1px solid var(--border)', fontWeight:800, color:'var(--text)' }}>
                          {trade.ticker}
                          {isHit && <span style={{ marginLeft:'6px', fontSize:'9px', background:'var(--bear)', color:'#fff', padding:'1px 5px', borderRadius:'3px' }}>HIT</span>}
                          {isNear && !isHit && <span style={{ marginLeft:'6px', fontSize:'9px', background:'rgba(239,68,68,0.2)', color:'var(--bear)', padding:'1px 5px', borderRadius:'3px' }}>NEAR</span>}
                        </td>
                        <td style={{ padding:'10px 14px', borderBottom:'1px solid var(--border)', color:'var(--muted)', fontSize:'11px' }}>{trade.account || '—'}</td>
                        <td style={{ padding:'10px 14px', borderBottom:'1px solid var(--border)', textAlign:'right' }}>{Number(trade.entry_price).toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2})}</td>
                        <td style={{ padding:'10px 14px', borderBottom:'1px solid var(--border)', textAlign:'right', fontWeight:600, color: isHit?'var(--bear)':'var(--text)' }}>
                          {cmp ? `Rs.${Number(cmp).toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2})}` : '—'}
                        </td>
                        <td style={{ padding:'10px 14px', borderBottom:'1px solid var(--border)', textAlign:'right', fontWeight:700, color:'var(--bear)' }}>
                          {Number(trade.stop_loss).toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2})}
                        </td>
                        <td style={{ padding:'10px 14px', borderBottom:'1px solid var(--border)', textAlign:'right', fontWeight:700, color:'var(--bear)' }}>
                          {slPct.toFixed(2)}%
                        </td>
                        <td style={{ padding:'10px 14px', borderBottom:'1px solid var(--border)', textAlign:'right' }}>
                          {dist !== null
                            ? <span style={{ fontWeight:700, color: isHit?'var(--bear)':isNear?'rgba(239,68,68,0.8)':'var(--bull)' }}>{dist>0?'+':''}{dist.toFixed(2)}%</span>
                            : <span style={{ color:'var(--muted)' }}>—</span>}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div style={{ marginTop: '20px', padding: '12px 16px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '11px', color: 'var(--muted)', fontFamily: 'DM Mono, monospace', lineHeight: 1.8 }}>
          ℹ️ Alerts checked every 15 min · Mon–Fri 9:15 AM – 3:30 PM IST · Email sent on trigger · ✓ = already triggered
        </div>
      </main>

      {showAdd && <AddAlertModal onClose={() => setShowAdd(false)} onAdd={handleAdd} />}
    </>
  )
}
