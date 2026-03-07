import { useState } from 'react'

export default function EditTradeModal({ trade, onClose, onSave }) {
  const [form, setForm] = useState({
    ticker: trade.ticker || '',
    direction: trade.direction || 'LONG',
    entry_date: trade.entry_date?.slice(0, 10) || '',
    entry_price: trade.entry_price || '',
    quantity: trade.quantity || '',
    mtf_value: trade.mtf_value || '',
    mtf_interest_rate: trade.mtf_interest_rate || '',
    notes: trade.notes || '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const investedCapital = form.entry_price && form.quantity
    ? parseFloat(form.entry_price) * parseFloat(form.quantity)
    : null

  const handleSave = async () => {
    setError('')
    if (!form.ticker.trim()) return setError('Ticker is required')
    if (!form.entry_price || !form.quantity || !form.entry_date) return setError('Entry price, quantity and date are required')
    setLoading(true)
    try {
      await onSave({
        ticker: form.ticker.toUpperCase().trim(),
        direction: form.direction,
        entry_date: form.entry_date,
        entry_price: parseFloat(form.entry_price),
        quantity: parseFloat(form.quantity),
        invested_capital: investedCapital,
        mtf_value: form.mtf_value ? parseFloat(form.mtf_value) : null,
        mtf_interest_rate: form.mtf_interest_rate ? parseFloat(form.mtf_interest_rate) : null,
        notes: form.notes || null,
      })
      onClose()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const field = {
    width: '100%', background: 'var(--surface2, #f1f5f9)',
    border: '1px solid var(--border, #e2e8f0)', borderRadius: '6px',
    padding: '9px 12px', color: 'var(--text, #1a1f36)',
    fontSize: '13px', fontFamily: 'DM Mono, Courier New, monospace', outline: 'none',
    boxSizing: 'border-box',
  }
  const label = {
    fontSize: '11px', color: 'var(--muted, #6b7a9e)', fontWeight: 600,
    letterSpacing: '0.08em', marginBottom: '5px', display: 'block',
    textTransform: 'uppercase',
  }
  const section = {
    fontSize: '10px', color: 'var(--accent, #0ea5e9)', fontWeight: 700,
    letterSpacing: '0.12em', textTransform: 'uppercase',
    borderBottom: '1px solid var(--border)', paddingBottom: '6px',
    marginBottom: '12px', marginTop: '20px',
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '16px',
    }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{
        background: 'var(--bg, #fff)', border: '1px solid var(--border)',
        borderRadius: '12px', padding: '28px', width: '100%', maxWidth: '560px',
        maxHeight: '90vh', overflowY: 'auto',
        boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div>
            <div style={{ fontFamily: 'Bookman Old Style, Libre Baskerville, Georgia, serif', fontWeight: 700, fontSize: '18px', color: 'var(--text)' }}>Edit Trade</div>
            <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '2px' }}>{trade.ticker} · {trade.account}</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '20px', color: 'var(--muted)', cursor: 'pointer' }}>×</button>
        </div>

        {/* Trade Info */}
        <div style={section}>Trade Info</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={label}>Ticker *</label>
            <input value={form.ticker} onChange={e => set('ticker', e.target.value)}
              placeholder="RELIANCE, TCS..." style={{ ...field, textTransform: 'uppercase' }} />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={label}>Direction *</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              {['LONG', 'SHORT'].map(d => (
                <button key={d} onClick={() => set('direction', d)} style={{
                  flex: 1, padding: '8px', borderRadius: '6px', cursor: 'pointer',
                  border: `1px solid ${form.direction === d ? (d === 'LONG' ? 'var(--bull, #16a34a)' : 'var(--bear, #dc2626)') : 'var(--border)'}`,
                  background: form.direction === d ? (d === 'LONG' ? 'rgba(22,163,74,0.1)' : 'rgba(220,38,38,0.1)') : 'var(--surface2)',
                  color: form.direction === d ? (d === 'LONG' ? 'var(--bull, #16a34a)' : 'var(--bear, #dc2626)') : 'var(--muted)',
                  fontWeight: 700, fontSize: '12px', fontFamily: 'DM Mono, monospace',
                }}>
                  {d === 'LONG' ? '▲ LONG' : '▼ SHORT'}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Entry Details */}
        <div style={section}>Entry Details</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
          <div>
            <label style={label}>Entry Date *</label>
            <input type="date" value={form.entry_date} onChange={e => set('entry_date', e.target.value)} style={field} />
          </div>
          <div>
            <label style={label}>Entry Price Rs *</label>
            <input type="number" value={form.entry_price} onChange={e => set('entry_price', e.target.value)}
              placeholder="0.00" style={field} step="0.01" min="0" />
          </div>
          <div>
            <label style={label}>Quantity *</label>
            <input type="number" value={form.quantity} onChange={e => set('quantity', e.target.value)}
              placeholder="100" style={field} min="1" />
          </div>
        </div>

        {investedCapital && (
          <div style={{ marginTop: '10px', padding: '8px 12px', background: 'var(--surface)', borderRadius: '6px', border: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '10px', color: 'var(--muted)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Invested Capital</span>
            <span style={{ color: 'var(--accent)', fontWeight: 600, fontFamily: 'DM Mono, monospace' }}>Rs{investedCapital.toLocaleString('en-IN')}</span>
          </div>
        )}

        {/* MTF Details */}
        <div style={section}>MTF Details <span style={{ color: 'var(--muted)', fontWeight: 400, textTransform: 'none', fontSize: '10px' }}>(optional)</span></div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <div>
            <label style={label}>MTF Value Rs</label>
            <input type="number" value={form.mtf_value} onChange={e => set('mtf_value', e.target.value)}
              placeholder="MTF amount" style={field} step="0.01" min="0" />
          </div>
          <div>
            <label style={label}>MTF Rate % p.a.</label>
            <input type="number" value={form.mtf_interest_rate} onChange={e => set('mtf_interest_rate', e.target.value)}
              placeholder="e.g. 18" style={field} step="0.01" min="0" max="100" />
          </div>
        </div>

        {/* Notes */}
        <div style={section}>Notes / Strategy</div>
        <textarea value={form.notes} onChange={e => set('notes', e.target.value)}
          placeholder="Why did you take this trade? Setup, catalyst, plan..."
          rows={3} style={{ ...field, resize: 'vertical' }} />

        {error && <div style={{ color: 'var(--bear, #dc2626)', fontSize: '12px', marginTop: '10px' }}>{error}</div>}

        <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
          <button onClick={onClose} style={{
            flex: 1, padding: '10px', background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: '6px', color: 'var(--muted)', cursor: 'pointer', fontSize: '13px',
          }}>Cancel</button>
          <button onClick={handleSave} disabled={loading} style={{
            flex: 2, padding: '10px', borderRadius: '6px', border: 'none',
            background: 'var(--accent, #0ea5e9)', color: '#fff',
            fontWeight: 700, fontSize: '13px', cursor: 'pointer',
          }}>
            {loading ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  )
}
