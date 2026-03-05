import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const EMPTY = {
  account: '',
  ticker: '',
  direction: 'LONG',
  entry_date: new Date().toISOString().slice(0, 10),
  entry_price: '',
  quantity: '',
  actual_investment: '',
  mtf_interest_rate: '',
  entry_reason: '',
  setup_pattern: '',
  sl_target_reasoning: '',
  exit_learning: '',
  mistakes: '',
}

const PATTERNS = [
  'Breakout', 'Breakdown', 'Reversal', 'Momentum', 'Swing',
  'Gap Up', 'Gap Down', 'Support Bounce', 'Resistance Rejection',
  'Trend Following', 'Mean Reversion', 'MTF Opportunity', 'Other'
]

const getToken = async () => {
  const { data: { session } } = await supabase.auth.getSession()
  return session?.access_token
}

// Format number in Indian system: 1,00,000
const toIndian = (num) => {
  if (!num && num !== 0) return ''
  return Number(num).toLocaleString('en-IN', { maximumFractionDigits: 2 })
}

export default function AddTradeModal({ onClose, onAdd }) {
  const [activeTab, setActiveTab] = useState('trade')
  const [form, setForm] = useState(EMPTY)
  const [accounts, setAccounts] = useState([])
  const [newAccount, setNewAccount] = useState('')
  const [showAddAccount, setShowAddAccount] = useState(false)
  const [loading, setLoading] = useState(false)
  const [accountLoading, setAccountLoading] = useState(false)
  const [error, setError] = useState('')

  // Parse all number fields
  const entryPrice = parseFloat(form.entry_price) || 0
  const quantity = parseFloat(form.quantity) || 0
  const actualInvestment = parseFloat(form.actual_investment) || 0
  const mtfRate = parseFloat(form.mtf_interest_rate) || 0

  // Core calculations
  const investedCapital = entryPrice > 0 && quantity > 0 ? entryPrice * quantity : null

  // MTF INT = ((Entry Price × Quantity) - Actual Investment) × Rate / 36500
  const mtfValue = investedCapital && actualInvestment > 0
    ? investedCapital - actualInvestment
    : null

  const dailyMTFInterest = mtfValue && mtfValue > 0 && mtfRate > 0
    ? (mtfValue * mtfRate) / 36500
    : null

  useEffect(() => { fetchAccounts() }, [])

  const fetchAccounts = async () => {
    const token = await getToken()
    if (!token) return
    try {
      const res = await fetch('/api/accounts', {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (Array.isArray(data)) setAccounts(data)
    } catch (e) { console.error('fetchAccounts error:', e) }
  }

  const handleAddAccount = async () => {
    if (!newAccount.trim()) return
    setAccountLoading(true)
    try {
      const token = await getToken()
      const res = await fetch('/api/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: newAccount }),
      })
      const data = await res.json()
      if (data.id) {
        await fetchAccounts()
        setForm(f => ({ ...f, account: data.name }))
        setNewAccount('')
        setShowAddAccount(false)
      } else {
        alert(data.error || 'Failed to add account')
      }
    } catch (e) { console.error('handleAddAccount error:', e) }
    finally { setAccountLoading(false) }
  }

  const handleDeleteAccount = async (id) => {
    try {
      const token = await getToken()
      await fetch('/api/accounts', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ id }),
      })
      await fetchAccounts()
    } catch (e) { console.error('handleDeleteAccount error:', e) }
  }

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    // Mandatory field validation
    if (!form.account)          return setError('Account is required')
    if (!form.ticker.trim())    return setError('Ticker is required')
    if (!form.entry_date)       return setError('Entry date is required')
    if (!form.entry_price)      return setError('Entry price is required')
    if (!form.quantity)         return setError('Quantity is required')
    if (!form.actual_investment) return setError('Actual Investment is required')
    if (!form.mtf_interest_rate) return setError('MTF Interest Rate is required')

    setLoading(true)
    try {
      await onAdd({
        account: form.account,
        ticker: form.ticker.toUpperCase().trim(),
        direction: form.direction,
        entry_date: form.entry_date,
        entry_price: entryPrice,
        quantity: quantity,
        invested_capital: investedCapital,
        actual_investment: actualInvestment,
        mtf_value: mtfValue && mtfValue > 0 ? Math.round(mtfValue * 100) / 100 : null,
        mtf_interest_rate: mtfRate,
        entry_reason: form.entry_reason || null,
        setup_pattern: form.setup_pattern || null,
        sl_target_reasoning: form.sl_target_reasoning || null,
        exit_learning: form.exit_learning || null,
        mistakes: form.mistakes || null,
        status: 'OPEN',
      })
      onClose()
    } catch (err) {
      setError(err.message)
      setActiveTab('trade')
    } finally { setLoading(false) }
  }

  const tabStyle = (t) => ({
    padding: '8px 20px', cursor: 'pointer', fontSize: '11px',
    letterSpacing: '0.08em', textTransform: 'uppercase',
    fontFamily: 'DM Mono, monospace', border: 'none',
    borderBottom: activeTab === t ? '2px solid var(--accent)' : '2px solid transparent',
    background: 'transparent',
    color: activeTab === t ? 'var(--accent)' : 'var(--muted)',
    fontWeight: activeTab === t ? 600 : 400, transition: 'all 0.15s',
  })

  const reqStar = <span style={{ color: '#dc2626', marginLeft: '2px' }}>*</span>

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: '600px' }}>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div className="modal-title" style={{ marginBottom: 0 }}>New Trade Entry</div>
            <div style={{ fontSize: '10px', color: 'var(--muted)', fontFamily: 'DM Mono, monospace', marginTop: '2px' }}>
              <span style={{ color: '#dc2626' }}>*</span> Required fields
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: '20px', lineHeight: 1 }}>×</button>
        </div>

        <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', marginBottom: '20px', marginTop: '8px' }}>
          <button style={tabStyle('trade')} onClick={() => setActiveTab('trade')}>📊 Trade Details</button>
          <button style={tabStyle('notes')} onClick={() => setActiveTab('notes')}>
            📝 Notes & Strategy
            {(form.entry_reason || form.setup_pattern) && (
              <span style={{ marginLeft: '6px', width: '6px', height: '6px', borderRadius: '50%', background: 'var(--accent)', display: 'inline-block', verticalAlign: 'middle' }} />
            )}
          </button>
        </div>

        <form onSubmit={handleSubmit}>

          {activeTab === 'trade' && (
            <div>
              <div className="section-divider" style={{ marginTop: 0 }}>Trade Info</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>

                {/* Account */}
                <div style={{ gridColumn: '1 / -1' }}>
                  <label className="field-label">Account {reqStar}</label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <select value={form.account} onChange={e => set('account', e.target.value)} className="field" style={{ flex: 1 }}>
                      <option value="">— Select Account —</option>
                      {accounts.map(a => <option key={a.id} value={a.name}>{a.name}</option>)}
                    </select>
                    <button type="button" onClick={() => setShowAddAccount(v => !v)} className="btn btn-ghost" style={{ padding: '7px 12px', whiteSpace: 'nowrap', fontSize: '11px' }}>
                      {showAddAccount ? 'Cancel' : '+ Add'}
                    </button>
                  </div>
                  {showAddAccount && (
                    <div style={{ marginTop: '8px', padding: '12px', background: 'var(--surface)', borderRadius: '6px', border: '1px solid var(--border)' }}>
                      <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                        <input value={newAccount} onChange={e => setNewAccount(e.target.value)} placeholder="e.g. ZERODHA" className="field" style={{ flex: 1, textTransform: 'uppercase' }} onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAddAccount())} />
                        <button type="button" onClick={handleAddAccount} disabled={accountLoading} className="btn btn-primary" style={{ padding: '7px 14px' }}>
                          {accountLoading ? '...' : 'Add'}
                        </button>
                      </div>
                      {accounts.length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                          {accounts.map(a => (
                            <span key={a.id} className="account-chip">
                              {a.name}
                              <button type="button" onClick={() => handleDeleteAccount(a.id)} style={{ background: 'none', border: 'none', color: 'var(--bear)', cursor: 'pointer', fontSize: '12px' }}>×</button>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Ticker */}
                <div>
                  <label className="field-label">Ticker {reqStar}</label>
                  <input value={form.ticker} onChange={e => set('ticker', e.target.value)} placeholder="RELIANCE, TCS..." className="field" style={{ textTransform: 'uppercase' }} />
                </div>

                {/* Direction */}
                <div>
                  <label className="field-label">Direction</label>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    {['LONG', 'SHORT'].map(d => (
                      <button key={d} type="button" onClick={() => set('direction', d)} style={{
                        flex: 1, padding: '7px', borderRadius: '4px', cursor: 'pointer',
                        border: `1px solid ${form.direction === d ? (d === 'LONG' ? '#16a34a' : '#dc2626') : 'var(--border)'}`,
                        background: form.direction === d ? (d === 'LONG' ? '#dcfce7' : '#fee2e2') : 'var(--surface)',
                        color: form.direction === d ? (d === 'LONG' ? '#16a34a' : '#dc2626') : 'var(--muted)',
                        fontSize: '11px', fontFamily: 'DM Mono, monospace',
                        fontWeight: form.direction === d ? 700 : 400, transition: 'all 0.15s',
                      }}>
                        {d === 'LONG' ? '▲ LONG' : '▼ SHORT'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Entry Details */}
              <div className="section-divider">Entry Details</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                <div>
                  <label className="field-label">Entry Date {reqStar}</label>
                  <input type="date" value={form.entry_date} onChange={e => set('entry_date', e.target.value)} className="field" />
                </div>
                <div>
                  <label className="field-label">Entry Price ₹ {reqStar}</label>
                  <input type="number" value={form.entry_price} onChange={e => set('entry_price', e.target.value)} placeholder="0.00" className="field" step="0.01" min="0" />
                </div>
                <div>
                  <label className="field-label">Quantity {reqStar}</label>
                  <input type="number" value={form.quantity} onChange={e => set('quantity', e.target.value)} placeholder="100" className="field" min="1" />
                </div>
              </div>

              {/* Invested Capital auto display */}
              {investedCapital && (
                <div style={{ marginTop: '10px', padding: '10px 14px', background: '#f0f8ff', borderRadius: '6px', border: '1px solid #bae6fd', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '11px', color: 'var(--muted)', fontFamily: 'DM Mono, monospace', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Invested Capital (Entry × Qty)</span>
                  <span style={{ color: 'var(--accent)', fontWeight: 700, fontFamily: 'Noto Sans, sans-serif', fontSize: '14px' }}>₹{toIndian(investedCapital)}</span>
                </div>
              )}

              {/* MTF Section */}
              <div className="section-divider">MTF Details</div>

              <div style={{ padding: '10px 14px', background: '#fffbeb', borderRadius: '6px', border: '1px solid #fde68a', marginBottom: '12px', fontSize: '11px', color: '#92400e', fontFamily: 'DM Mono, monospace', lineHeight: 1.8 }}>
                💡 Formula: MTF INT = (Invested Capital − Actual Investment) × Rate% ÷ 36500
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label className="field-label">Actual Investment ₹ {reqStar}</label>
                  <input type="number" value={form.actual_investment} onChange={e => set('actual_investment', e.target.value)} placeholder="Amount you paid" className="field" step="0.01" min="0" />
                  {actualInvestment > 0 && (
                    <div style={{ fontSize: '10px', color: 'var(--muted)', marginTop: '3px', fontFamily: 'DM Mono, monospace' }}>
                      = ₹{toIndian(actualInvestment)}
                    </div>
                  )}
                </div>
                <div>
                  <label className="field-label">MTF Interest Rate % p.a. {reqStar}</label>
                  <input type="number" value={form.mtf_interest_rate} onChange={e => set('mtf_interest_rate', e.target.value)} placeholder="e.g. 14" className="field" step="0.01" min="0" max="100" />
                </div>
              </div>

              {/* Live MTF Calculation Preview */}
              {mtfValue !== null && mtfValue > 0 && mtfRate > 0 && (
                <div style={{ marginTop: '12px', padding: '12px 14px', background: '#fff7ed', borderRadius: '6px', border: '1px solid #fed7aa' }}>
                  <div style={{ fontSize: '10px', color: '#92400e', fontFamily: 'DM Mono, monospace', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>MTF Calculation Preview</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ fontSize: '11px', color: 'var(--muted)', fontFamily: 'DM Mono, monospace' }}>MTF Amount (Invested − Actual)</span>
                    <span style={{ fontWeight: 700, fontFamily: 'Noto Sans, sans-serif', color: '#ea580c' }}>₹{toIndian(mtfValue)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '11px', color: 'var(--muted)', fontFamily: 'DM Mono, monospace' }}>Daily MTF Interest</span>
                    <span style={{ fontWeight: 700, fontFamily: 'Noto Sans, sans-serif', color: '#f59e0b' }}>₹{toIndian(dailyMTFInterest)}/day</span>
                  </div>
                </div>
              )}

              {error && <p style={{ color: '#dc2626', fontSize: '11px', marginTop: '12px', fontFamily: 'DM Mono, monospace', background: '#fee2e2', padding: '8px 12px', borderRadius: '4px' }}>{error}</p>}

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px', gap: '8px' }}>
                <button type="button" onClick={onClose} className="btn btn-ghost">Cancel</button>
                <button type="button" onClick={() => setActiveTab('notes')} className="btn btn-ghost" style={{ borderColor: 'var(--accent)', color: 'var(--accent)' }}>
                  Next: Notes →
                </button>
                <button type="submit" disabled={loading} className="btn btn-primary">
                  {loading ? 'Adding...' : '+ Add Trade'}
                </button>
              </div>
            </div>
          )}

          {activeTab === 'notes' && (
            <div>
              <div style={{ marginBottom: '16px', padding: '10px 14px', background: 'var(--surface)', borderRadius: '6px', border: '1px solid var(--border)', fontSize: '11px', color: 'var(--muted)', fontFamily: 'DM Mono, monospace' }}>
                📝 All notes are optional but highly recommended for improving your trading.
              </div>

              <div style={{ marginBottom: '14px' }}>
                <label className="field-label">Setup / Pattern</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
                  {PATTERNS.map(p => (
                    <button key={p} type="button" onClick={() => set('setup_pattern', form.setup_pattern === p ? '' : p)} style={{
                      padding: '4px 10px', borderRadius: '4px',
                      border: `1px solid ${form.setup_pattern === p ? 'var(--accent)' : 'var(--border)'}`,
                      background: form.setup_pattern === p ? '#e0f2fe' : 'transparent',
                      color: form.setup_pattern === p ? 'var(--accent)' : 'var(--muted)',
                      fontSize: '10px', cursor: 'pointer', fontFamily: 'DM Mono, monospace', transition: 'all 0.15s',
                    }}>{p}</button>
                  ))}
                </div>
                <input value={form.setup_pattern} onChange={e => set('setup_pattern', e.target.value)} placeholder="Or type your own pattern..." className="field" />
              </div>

              <div style={{ marginBottom: '12px' }}>
                <label className="field-label">Why I Entered This Trade</label>
                <textarea value={form.entry_reason} onChange={e => set('entry_reason', e.target.value)} placeholder="What was your reasoning? What did you see on the chart?" className="field" rows={3} style={{ resize: 'vertical' }} />
              </div>

              <div style={{ marginBottom: '12px' }}>
                <label className="field-label">Stop Loss & Target Reasoning</label>
                <textarea value={form.sl_target_reasoning} onChange={e => set('sl_target_reasoning', e.target.value)} placeholder="Where is your stop loss? Where is your target? Why?" className="field" rows={2} style={{ resize: 'vertical' }} />
              </div>

              <div style={{ marginBottom: '12px' }}>
                <label className="field-label">What I Learned After Exit</label>
                <textarea value={form.exit_learning} onChange={e => set('exit_learning', e.target.value)} placeholder="What did this trade teach you?" className="field" rows={2} style={{ resize: 'vertical' }} />
              </div>

              <div style={{ marginBottom: '12px' }}>
                <label className="field-label">Mistakes Made</label>
                <textarea value={form.mistakes} onChange={e => set('mistakes', e.target.value)} placeholder="Did you break your rules? What went wrong?" className="field" rows={2} style={{ resize: 'vertical' }} />
              </div>

              {error && <p style={{ color: '#dc2626', fontSize: '11px', marginBottom: '10px', fontFamily: 'DM Mono, monospace' }}>{error}</p>}

              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '8px' }}>
                <button type="button" onClick={onClose} className="btn btn-ghost">Cancel</button>
                <button type="button" onClick={() => setActiveTab('trade')} className="btn btn-ghost">← Back</button>
                <button type="submit" disabled={loading} className="btn btn-primary">
                  {loading ? 'Adding...' : '+ Add Trade'}
                </button>
              </div>
            </div>
          )}

        </form>
      </div>
    </div>
  )
}
