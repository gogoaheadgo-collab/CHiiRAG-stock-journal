import { useState } from 'react'

const PATTERNS = [
  'Breakout', 'Breakdown', 'Reversal', 'Momentum', 'Swing',
  'Gap Up', 'Gap Down', 'Support Bounce', 'Resistance Rejection',
  'Trend Following', 'Mean Reversion', 'MTF Opportunity', 'Other'
]

export default function EditTradeModal({ trade, onClose, onSave }) {
  const [form, setForm] = useState({
    account: trade.account || '',
    ticker: trade.ticker || '',
    direction: trade.direction || 'LONG',
    entry_date: trade.entry_date?.slice(0, 10) || '',
    entry_price: trade.entry_price || '',
    quantity: trade.quantity || '',
    actual_investment: trade.actual_investment || '',
    mtf_interest_rate: trade.mtf_interest_rate || '',
    exit_price: trade.exit_price || '',
    exit_date: trade.exit_date?.slice(0, 10) || '',
    realized_gains: trade.realized_gains || '',
    status: trade.status || 'OPEN',
    entry_reason: trade.entry_reason || '',
    setup_pattern: trade.setup_pattern || '',
    sl_target_reasoning: trade.sl_target_reasoning || '',
    exit_learning: trade.exit_learning || '',
    mistakes: trade.mistakes || '',
  })
  const [activeTab, setActiveTab] = useState('trade')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  // Auto-calculated — all as numbers
  const entryPrice = parseFloat(form.entry_price) || 0
  const quantity = parseFloat(form.quantity) || 0
  const investedCapital = entryPrice > 0 && quantity > 0 ? entryPrice * quantity : null
  const actualInvestment = parseFloat(form.actual_investment) || 0
  const mtfRate = parseFloat(form.mtf_interest_rate) || 0

  // MTF = Actual Investment - Invested Capital
  const mtfValue = actualInvestment > 0 && investedCapital > 0
    ? actualInvestment - investedCapital
    : trade.mtf_value || null

  const dailyMTFInterest = mtfValue && mtfValue > 0 && mtfRate > 0
    ? (mtfValue * mtfRate) / 36500
    : null

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (!form.ticker.trim()) return setError('Ticker is required')
    if (!form.entry_price || !form.quantity) return setError('Entry price and quantity are required')

    setLoading(true)
    try {
      await onSave({
        account: form.account,
        ticker: form.ticker.toUpperCase().trim(),
        direction: form.direction,
        entry_date: form.entry_date,
        entry_price: entryPrice,
        quantity: quantity,
        invested_capital: investedCapital,
        actual_investment: actualInvestment > 0 ? actualInvestment : null,
        mtf_value: mtfValue && mtfValue > 0 ? Math.round(mtfValue * 100) / 100 : null,
        mtf_interest_rate: mtfRate > 0 ? mtfRate : null,
        exit_price: form.exit_price ? parseFloat(form.exit_price) : null,
        exit_date: form.exit_date || null,
        realized_gains: form.realized_gains !== '' ? parseFloat(form.realized_gains) : null,
        status: form.status,
        entry_reason: form.entry_reason || null,
        setup_pattern: form.setup_pattern || null,
        sl_target_reasoning: form.sl_target_reasoning || null,
        exit_learning: form.exit_learning || null,
        mistakes: form.mistakes || null,
      })
      onClose()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
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

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: '620px' }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div className="modal-title" style={{ marginBottom: '2px' }}>Edit Trade</div>
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              <span className={`badge badge-${trade.status.toLowerCase()}`}>{trade.status}</span>
              <span style={{ fontSize: '12px', color: 'var(--muted)', fontFamily: 'Noto Sans, sans-serif' }}>{trade.ticker}</span>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: '20px', lineHeight: 1 }}>×</button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', marginBottom: '20px', marginTop: '12px' }}>
          <button style={tabStyle('trade')} onClick={() => setActiveTab('trade')}>📊 Trade Details</button>
          <button style={tabStyle('exit')} onClick={() => setActiveTab('exit')}>🏁 Exit Details</button>
          <button style={tabStyle('notes')} onClick={() => setActiveTab('notes')}>📝 Notes</button>
        </div>

        <form onSubmit={handleSubmit}>

          {/* ── TAB 1: Trade Details ── */}
          {activeTab === 'trade' && (
            <div>
              <div className="section-divider" style={{ marginTop: 0 }}>Trade Info</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>

                <div>
                  <label className="field-label">Ticker *</label>
                  <input value={form.ticker} onChange={e => set('ticker', e.target.value)} className="field" style={{ textTransform: 'uppercase' }} />
                </div>

                <div>
                  <label className="field-label">Account</label>
                  <input value={form.account} onChange={e => set('account', e.target.value)} className="field" />
                </div>

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

                <div>
                  <label className="field-label">Status</label>
                  <select value={form.status} onChange={e => set('status', e.target.value)} className="field">
                    <option value="OPEN">OPEN</option>
                    <option value="CLOSED">CLOSED</option>
                  </select>
                </div>
              </div>

              <div className="section-divider">Entry Details</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                <div>
                  <label className="field-label">Entry Date</label>
                  <input type="date" value={form.entry_date} onChange={e => set('entry_date', e.target.value)} className="field" />
                </div>
                <div>
                  <label className="field-label">Entry Price</label>
                  <input type="number" value={form.entry_price} onChange={e => set('entry_price', e.target.value)} className="field" step="0.01" min="0" />
                </div>
                <div>
                  <label className="field-label">Quantity</label>
                  <input type="number" value={form.quantity} onChange={e => set('quantity', e.target.value)} className="field" min="1" />
                </div>
              </div>

              {investedCapital && (
                <div style={{ marginTop: '10px', padding: '10px 14px', background: '#f0f8ff', borderRadius: '6px', border: '1px solid #bae6fd', display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '11px', color: 'var(--muted)', fontFamily: 'DM Mono, monospace', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Invested Capital (auto)</span>
                  <span style={{ color: 'var(--accent)', fontWeight: 700, fontFamily: 'Noto Sans, sans-serif' }}>₹{investedCapital.toLocaleString('en-IN')}</span>
                </div>
              )}

              <div className="section-divider">MTF Details <span style={{ color: 'var(--border2)', fontWeight: 400 }}>(optional)</span></div>
              <div style={{ padding: '10px 14px', background: '#fffbeb', borderRadius: '6px', border: '1px solid #fde68a', marginBottom: '12px', fontSize: '11px', color: '#92400e', fontFamily: 'DM Mono, monospace' }}>
                💡 MTF = Actual Investment − Invested Capital
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label className="field-label">Actual Investment</label>
                  <input type="number" value={form.actual_investment} onChange={e => set('actual_investment', e.target.value)} placeholder="Total amount paid" className="field" step="0.01" min="0" />
                </div>
                <div>
                  <label className="field-label">MTF Interest Rate % p.a.</label>
                  <input type="number" value={form.mtf_interest_rate} onChange={e => set('mtf_interest_rate', e.target.value)} placeholder="e.g. 18" className="field" step="0.01" min="0" max="100" />
                </div>
              </div>

              {mtfValue !== null && (
                <div style={{ marginTop: '10px', padding: '10px 14px', background: '#fff7ed', borderRadius: '6px', border: '1px solid #fed7aa' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: dailyMTFInterest ? '4px' : 0 }}>
                    <span style={{ fontSize: '11px', color: 'var(--muted)', fontFamily: 'DM Mono, monospace', textTransform: 'uppercase', letterSpacing: '0.08em' }}>MTF Amount (auto)</span>
                    <span style={{ color: '#ea580c', fontWeight: 700, fontFamily: 'Noto Sans, sans-serif' }}>₹{Math.abs(mtfValue).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
                  </div>
                  {dailyMTFInterest && (
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '11px', color: 'var(--muted)', fontFamily: 'DM Mono, monospace', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Daily Interest</span>
                      <span style={{ color: '#f59e0b', fontWeight: 700, fontFamily: 'Noto Sans, sans-serif' }}>₹{dailyMTFInterest.toFixed(2)}/day</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── TAB 2: Exit Details ── */}
          {activeTab === 'exit' && (
            <div>
              <div className="section-divider" style={{ marginTop: 0 }}>Exit Details</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label className="field-label">Exit Price</label>
                  <input type="number" value={form.exit_price} onChange={e => set('exit_price', e.target.value)} placeholder="0.00" className="field" step="0.01" min="0" />
                </div>
                <div>
                  <label className="field-label">Exit Date</label>
                  <input type="date" value={form.exit_date} onChange={e => set('exit_date', e.target.value)} className="field" />
                </div>
              </div>

              <div style={{ marginTop: '14px' }}>
                <label className="field-label">Realised P&L (override)</label>
                <input
                  type="number" value={form.realized_gains}
                  onChange={e => set('realized_gains', e.target.value)}
                  placeholder="Leave blank to auto-calculate from exit price"
                  className="field" step="0.01"
                />
                <div style={{ fontSize: '10px', color: 'var(--muted)', marginTop: '4px', fontFamily: 'DM Mono, monospace' }}>
                  💡 If left blank, P&L will be auto-calculated from exit price
                </div>
              </div>

              {/* P&L Preview */}
              {form.exit_price && form.entry_price && form.quantity && (
                (() => {
                  const ep = parseFloat(form.exit_price)
                  const en = parseFloat(form.entry_price)
                  const qty = parseFloat(form.quantity)
                  const pnl = form.direction === 'LONG' ? (ep - en) * qty : (en - ep) * qty
                  const pct = investedCapital ? (pnl / investedCapital) * 100 : null
                  return (
                    <div style={{ marginTop: '14px', padding: '16px', borderRadius: '8px', background: pnl >= 0 ? '#f0fdf4' : '#fff1f2', border: `1px solid ${pnl >= 0 ? '#bbf7d0' : '#fecdd3'}`, textAlign: 'center' }}>
                      <div style={{ fontSize: '10px', color: 'var(--muted)', fontFamily: 'DM Mono, monospace', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '6px' }}>P&L Preview</div>
                      <div style={{ fontFamily: 'Noto Sans, sans-serif', fontSize: '26px', fontWeight: 700, color: pnl >= 0 ? '#16a34a' : '#dc2626' }}>
                        {pnl >= 0 ? '+' : '−'}₹{Math.abs(pnl).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                      </div>
                      {pct !== null && (
                        <div style={{ fontSize: '12px', color: pnl >= 0 ? '#16a34a' : '#dc2626', marginTop: '2px', fontFamily: 'Noto Sans, sans-serif' }}>
                          {pct >= 0 ? '+' : ''}{pct.toFixed(2)}%
                        </div>
                      )}
                    </div>
                  )
                })()
              )}
            </div>
          )}

          {/* ── TAB 3: Notes ── */}
          {activeTab === 'notes' && (
            <div>
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
                <input value={form.setup_pattern} onChange={e => set('setup_pattern', e.target.value)} placeholder="Or type your own..." className="field" />
              </div>

              <div style={{ marginBottom: '12px' }}>
                <label className="field-label">Why I Entered This Trade</label>
                <textarea value={form.entry_reason} onChange={e => set('entry_reason', e.target.value)} placeholder="Your reasoning..." className="field" rows={2} style={{ resize: 'vertical' }} />
              </div>

              <div style={{ marginBottom: '12px' }}>
                <label className="field-label">Stop Loss & Target Reasoning</label>
                <textarea value={form.sl_target_reasoning} onChange={e => set('sl_target_reasoning', e.target.value)} placeholder="SL and target logic..." className="field" rows={2} style={{ resize: 'vertical' }} />
              </div>

              <div style={{ marginBottom: '12px' }}>
                <label className="field-label">What I Learned After Exit</label>
                <textarea value={form.exit_learning} onChange={e => set('exit_learning', e.target.value)} placeholder="Key learnings..." className="field" rows={2} style={{ resize: 'vertical' }} />
              </div>

              <div style={{ marginBottom: '12px' }}>
                <label className="field-label">Mistakes Made</label>
                <textarea value={form.mistakes} onChange={e => set('mistakes', e.target.value)} placeholder="What went wrong..." className="field" rows={2} style={{ resize: 'vertical' }} />
              </div>
            </div>
          )}

          {error && <p style={{ color: '#dc2626', fontSize: '11px', marginTop: '10px', fontFamily: 'DM Mono, monospace' }}>{error}</p>}

          {/* Footer buttons always visible */}
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '20px', paddingTop: '16px', borderTop: '1px solid var(--border)' }}>
            <button type="button" onClick={onClose} className="btn btn-ghost">Cancel</button>
            <button type="submit" disabled={loading} className="btn btn-primary">
              {loading ? 'Saving...' : '💾 Save Changes'}
            </button>
          </div>

        </form>
      </div>
    </div>
  )
}
