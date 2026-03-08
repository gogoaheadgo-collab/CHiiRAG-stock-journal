import { useState, useEffect } from 'react'

const EMPTY = {
  account: '',
  ticker: '',
  direction: 'LONG',
  entry_date: new Date().toISOString().slice(0, 10),
  entry_price: '',
  quantity: '',
  mtf_value: '',
  mtf_interest_rate: '',
  notes: '',
}

export default function AddTradeModal({ session, onClose, onAdd }) {
  const [form, setForm] = useState(EMPTY)
  const [accounts, setAccounts] = useState([])
  const [newAccount, setNewAccount] = useState('')
  const [showAddAccount, setShowAddAccount] = useState(false)
  const [loading, setLoading] = useState(false)
  const [accountLoading, setAccountLoading] = useState(false)
  const [error, setError] = useState('')
  const [suggestions, setSuggestions] = useState([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [searchLoading, setSearchLoading] = useState(false)

  // Derived calcs
  const investedCapital = form.entry_price && form.quantity
    ? (parseFloat(form.entry_price) * parseFloat(form.quantity)).toFixed(2)
    : ''

  useEffect(() => { fetchAccounts() }, [])

  const fetchAccounts = async () => {
    const token = session?.access_token
    if (!token) return
    const res = await fetch('/api/accounts', {
      headers: { Authorization: `Bearer ${token}` },
    })
    const data = await res.json()
    if (Array.isArray(data)) setAccounts(data)
  }

  const handleAddAccount = async () => {
    if (!newAccount.trim()) return
    setAccountLoading(true)
    const res = await fetch('/api/accounts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session?.access_token}`,
      },
      body: JSON.stringify({ name: newAccount }),
    })
    const data = await res.json()
    if (data.id) {
      await fetchAccounts()
      setForm(f => ({ ...f, account: data.name }))
      setNewAccount('')
      setShowAddAccount(false)
    }
    setAccountLoading(false)
  }

  const handleDeleteAccount = async (id) => {
    await fetch('/api/accounts', {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session?.access_token}`,
      },
      body: JSON.stringify({ id }),
    })
    await fetchAccounts()
  }

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const searchTicker = async (query) => {
    set('ticker', query)
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
    set('ticker', item.ticker)
    setSuggestions([])
    setShowSuggestions(false)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (!form.account) return setError('Select an account')
    if (!form.ticker.trim()) return setError('Enter a ticker symbol')
    if (!form.entry_price || !form.quantity || !form.entry_date) return setError('Entry price, quantity and date are required')

    setLoading(true)
    try {
      await onAdd({
        account: form.account,
        ticker: form.ticker.toUpperCase().trim(),
        direction: form.direction,
        entry_date: form.entry_date,
        entry_price: parseFloat(form.entry_price),
        quantity: parseFloat(form.quantity),
        invested_capital: investedCapital ? parseFloat(investedCapital) : null,
        mtf_value: form.mtf_value ? parseFloat(form.mtf_value) : null,
        mtf_interest_rate: form.mtf_interest_rate ? parseFloat(form.mtf_interest_rate) : null,
        notes: form.notes || null,
        status: 'OPEN',
      })
      onClose()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: '580px' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '22px' }}>
          <div>
            <div className="modal-title" style={{ marginBottom: '2px' }}>New Trade Entry</div>
            <div style={{ fontSize: '10px', color: 'var(--muted)' }}>All fields marked * are required</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: '20px', lineHeight: 1, padding: '2px' }}>×</button>
        </div>

        <form onSubmit={handleSubmit}>

          {/* ── Section: Account & Direction ── */}
          <div className="section-divider">Trade Info</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>

            {/* Account dropdown */}
            <div style={{ gridColumn: '1 / -1' }}>
              <label className="field-label">Account *</label>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                <select
                  value={form.account}
                  onChange={e => set('account', e.target.value)}
                  className="field"
                  style={{ flex: 1 }}
                >
                  <option value="">— Select Account —</option>
                  {accounts.map(a => (
                    <option key={a.id} value={a.name}>{a.name}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setShowAddAccount(v => !v)}
                  className="btn btn-ghost"
                  style={{ padding: '7px 12px', whiteSpace: 'nowrap', fontSize: '11px' }}
                >
                  {showAddAccount ? 'Cancel' : '+ Add'}
                </button>
              </div>

              {/* Inline add account */}
              {showAddAccount && (
                <div style={{ marginTop: '8px', padding: '12px', background: 'var(--bg)', borderRadius: '4px', border: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
                    <input
                      value={newAccount}
                      onChange={e => setNewAccount(e.target.value)}
                      placeholder="Account name (e.g. RAVI)"
                      className="field"
                      style={{ flex: 1, textTransform: 'uppercase' }}
                      onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAddAccount())}
                    />
                    <button
                      type="button"
                      onClick={handleAddAccount}
                      disabled={accountLoading}
                      className="btn btn-primary"
                      style={{ padding: '7px 14px' }}
                    >
                      {accountLoading ? '...' : 'Add'}
                    </button>
                  </div>
                  {accounts.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      {accounts.map(a => (
                        <span key={a.id} className="account-chip">
                          {a.name}
                          <button
                            type="button"
                            onClick={() => handleDeleteAccount(a.id)}
                            style={{ background: 'none', border: 'none', color: 'var(--red)', cursor: 'pointer', fontSize: '12px', lineHeight: 1, padding: '0' }}
                          >×</button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Ticker with autocomplete */}
            <div style={{ position:'relative' }}>
              <label className="field-label">Ticker * {searchLoading && <span style={{ color:'var(--muted)', fontWeight:400 }}>searching...</span>}</label>
              <input
                value={form.ticker}
                onChange={e => searchTicker(e.target.value.toUpperCase())}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
                placeholder="Type to search: RELI, TCS..."
                className="field"
                style={{ textTransform: 'uppercase' }}
                autoComplete="off"
              />
              {showSuggestions && suggestions.length > 0 && (
                <div style={{ position:'absolute', top:'100%', left:0, right:0, zIndex:999, background:'var(--bg)', border:'1px solid var(--accent)', borderRadius:'6px', boxShadow:'0 8px 24px rgba(0,0,0,0.15)', maxHeight:'220px', overflowY:'auto', marginTop:'2px' }}>
                  {suggestions.map((item, i) => (
                    <div key={i} onMouseDown={() => selectTicker(item)} style={{ padding:'8px 12px', cursor:'pointer', borderBottom:'1px solid var(--border)', display:'flex', justifyContent:'space-between', alignItems:'center' }}
                      onMouseEnter={e => e.currentTarget.style.background='var(--surface)'}
                      onMouseLeave={e => e.currentTarget.style.background='transparent'}>
                      <div>
                        <div style={{ fontFamily:'DM Mono, monospace', fontWeight:700, fontSize:'13px', color:'var(--accent)' }}>{item.ticker}</div>
                        <div style={{ fontSize:'10px', color:'var(--muted)', marginTop:'1px' }}>{item.shortName}</div>
                      </div>
                      <div style={{ fontSize:'10px', fontFamily:'DM Mono, monospace', color:'var(--muted)', background:'var(--surface)', padding:'2px 6px', borderRadius:'3px' }}>{item.exchange}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Direction */}
            <div>
              <label className="field-label">Direction *</label>
              <div style={{ display: 'flex', gap: '6px' }}>
                {['LONG', 'SHORT'].map(d => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => set('direction', d)}
                    style={{
                      flex: 1,
                      padding: '7px',
                      borderRadius: '4px',
                      border: `1px solid ${form.direction === d ? (d === 'LONG' ? 'var(--green)' : 'var(--red)') : 'var(--border)'}`,
                      background: form.direction === d ? (d === 'LONG' ? 'rgba(0,230,118,0.1)' : 'rgba(255,71,87,0.1)') : 'var(--surface2)',
                      color: form.direction === d ? (d === 'LONG' ? 'var(--green)' : 'var(--red)') : 'var(--muted)',
                      cursor: 'pointer',
                      fontSize: '11px',
                      fontFamily: 'IBM Plex Mono, monospace',
                      fontWeight: form.direction === d ? 600 : 400,
                      letterSpacing: '0.06em',
                      transition: 'all 0.15s',
                    }}
                  >
                    {d === 'LONG' ? '▲ LONG' : '▼ SHORT'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* ── Section: Entry Details ── */}
          <div className="section-divider">Entry Details</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
            <div>
              <label className="field-label">Entry Date *</label>
              <input type="date" value={form.entry_date} onChange={e => set('entry_date', e.target.value)} className="field" />
            </div>
            <div>
              <label className="field-label">Entry Price Rs *</label>
              <input type="number" value={form.entry_price} onChange={e => set('entry_price', e.target.value)} placeholder="0.00" className="field" step="0.01" min="0" />
            </div>
            <div>
              <label className="field-label">Quantity *</label>
              <input type="number" value={form.quantity} onChange={e => set('quantity', e.target.value)} placeholder="100" className="field" min="1" />
            </div>
          </div>

          {/* Invested Capital (auto-calc display) */}
          {investedCapital && (
            <div style={{ marginTop: '10px', padding: '8px 12px', background: 'var(--bg)', borderRadius: '4px', border: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '10px', color: 'var(--muted)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Invested Capital</span>
              <span style={{ color: 'var(--accent)', fontWeight: 500 }}>Rs{parseFloat(investedCapital).toLocaleString('en-IN')}</span>
            </div>
          )}

          {/* ── Section: MTF Details ── */}
          <div className="section-divider">MTF Details <span style={{ color: 'var(--border2)', fontWeight: 400 }}>(optional)</span></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label className="field-label">MTF Value Rs</label>
              <input type="number" value={form.mtf_value} onChange={e => set('mtf_value', e.target.value)} placeholder="Exact MTF amount" className="field" step="0.01" min="0" />
            </div>
            <div>
              <label className="field-label">MTF Interest Rate % p.a.</label>
              <input type="number" value={form.mtf_interest_rate} onChange={e => set('mtf_interest_rate', e.target.value)} placeholder="e.g. 18" className="field" step="0.01" min="0" max="100" />
            </div>
          </div>
          {form.mtf_value && form.mtf_interest_rate && (
            <div style={{ marginTop: '8px', padding: '8px 12px', background: 'var(--bg)', borderRadius: '4px', border: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '10px', color: 'var(--muted)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Daily MTF Interest</span>
              <span style={{ color: 'var(--gold)', fontWeight: 500 }}>
                Rs{((parseFloat(form.mtf_value) * parseFloat(form.mtf_interest_rate)) / 36500).toFixed(2)}/day
              </span>
            </div>
          )}

          {/* ── Notes ── */}
          <div className="section-divider">Notes / Strategy</div>
          <textarea
            value={form.notes}
            onChange={e => set('notes', e.target.value)}
            placeholder="Why did you take this trade? Setup, catalyst, plan..."
            className="field"
            rows={3}
            style={{ resize: 'vertical' }}
          />

          {error && <p style={{ color: 'var(--red)', fontSize: '11px', marginTop: '10px' }}>{error}</p>}

          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '20px' }}>
            <button type="button" onClick={onClose} className="btn btn-ghost">Cancel</button>
            <button type="submit" disabled={loading} className="btn btn-primary">
              {loading ? 'Adding...' : '+ Add Trade'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
