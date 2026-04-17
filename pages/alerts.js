import React, { useState, useEffect, useCallback } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'
import { supabase } from '../lib/supabase'

const ADMIN_EMAIL = 'gogoaheadgo@gmail.com'

function NavPill({ active, isAdmin }) {
  const router = useRouter()
  const items = [
    { label: 'Dashboard', path: '/dashboard' },
    { label: 'Accounts', path: '/accounts' },
    ...(isAdmin ? [
      { label: 'Subscribers', path: '/subscribers' },
      { label: 'All Trades', path: '/all-trades' },
    ] : []),
    { label: 'Revenue Sharing', path: '/revenue-sharing' },
    { label: 'Alerts', path: '/alerts' },
    { label: 'Notes', path: '/notes' },
  ]
  return (
    <div style={{ display: 'flex', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px', padding: '3px', gap: '2px', flexWrap: 'wrap' }}>
      {items.map(({ label, path }) => (
        <button key={path} onClick={() => router.push(path)} style={{
          padding: '7px 18px', borderRadius: '6px', border: 'none', cursor: 'pointer',
          fontSize: '11px', fontFamily: 'DM Mono, monospace', fontWeight: 600,
          background: active === label ? 'var(--accent)' : 'transparent',
          color: active === label ? '#fff' : 'var(--muted)',
        }}>{label}</button>
      ))}
    </div>
  )
}

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
  const [loading, setLoading] = useState(true)
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

  // First useEffect: load alerts when session is present
  useEffect(() => {
    if (session) loadAlerts()
  }, [session, loadAlerts])

  // Silent refresh on tab focus
  useEffect(() => {
    const _onFocus = () => {
      if (session) loadAlerts(true)
    }
    window.addEventListener('focus', _onFocus)
    return () => window.removeEventListener('focus', _onFocus)
  }, [session])

  useEffect(() => {
    const tickers = [...new Set(alerts.filter(a => a.status === 'ACTIVE').map(a => a.ticker))]
    // Also fetch prices for SL trade tickers
    const slTickers = [...new Set(slTrades.map(t => t.ticker))]
    ;[...tickers, ...slTickers].forEach(async ticker => {
      try {
        con[...tickers, ...slTickers].forEach(async ti        const d = await r.js[...tickers, ...slTickers].forEach(async ti..slTickers].forEach(async tirEach(async titch {}
    })
  },[...tickers, ...slTickers].forEach(async ti) => {
    const t[...tickers, ...slTickers].forEach(async tiit fetch('/api/price-alerts[...tickers, ...slTickers].forEach(async ti 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(form),
    })
    const [...tickers, ...slTickers].forEach(async tis].forEach(async tita.error)
    await loadAler[...tickers, ...slTickers].forEach(async ti => {
    i[...tickers, ...slTickers].forEach(async ti].forEach(async tianently removed.')) return
    if (!con[...tickers, ...slTickers].forEach(async tiis cannot be un[...tickers, ...slTickers].forEach(async tiToken()
    await fetc[...tickers, ...slTickers].forEach(async tirs].forEach(async ti { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ id }),
    })
    a[...tickers, ...slTickers].forEach(async ti = async [...tickers, ...slTickers].forEach(async tigetToken()
    await fetch('/api/price-alerts[...tickers, ...slTickers].forEach(async ti'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ id, status: current === 'ACTIVE' ? 'PAUSED' : 'ACTIVE' }),
    })
    await loadA[...tickers, ...slTickers].forEach(async tid) => {
    c[...tickers, ...slTickers].forEach(async tirEach(async tiets via[...tickers, ...slTickers].forEach(async ti
      me[...tickers, ...slTickers].forEach(async titickers, ...slTickers].forEach(async tic ti
