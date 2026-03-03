import { useState } from 'react'

export default function CloseTradeModal({ trade, onClose, onConfirm }) {
  const [exitPrice, setExitPrice] = useState('')
  const [exitDate, setExitDate] = useState(new Date().toISOString().slice(0, 10))
  const [exitNotes, setExitNotes] = useState('')
  const [loading, setLoading] = useState(false)

  const qty = trade.quantity
  const entry = trade.entry_price
  const exit = exitPrice ? parseFloat(exitPrice) : null
  const isLong = trade.direction === 'LONG'

  const pnl = exit
    ? isLong
      ? (exit - entry) * qty
      : (entry - exit) * qty
    : null

  const pnlPct = exit && entry > 0
    ? isLong
      ? ((exit - entry) / entry) * 100
      : ((entry - exit) / entry) * 100
    : null

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!exitPrice) return
    setLoading(true)
    try {
      await onConfirm({
        exit_price: parseFloat(exitPrice),
        exit_date: exitDate,
        exit_notes: exitNotes || null,
        status: 'CLOSED',
        realized_gains: pnl,
      })
      onClose()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: '420px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div>
            <div className="modal-title" style={{ marginBottom: '2px' }}>
              Exit Trade — {trade.ticker}
            </div>
            <div style={{ display: 'flex', gap: '6px' }}>
              <span className={`badge badge-${trade.direction.toLowerCase()}`}>{trade.direction}</span>
              <span style={{ fontSize: '10px', color: 'var(--muted)' }}>{trade.quantity} shares @ ₹{trade.entry_price}</span>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: '20px', lineHeight: 1 }}>×</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label className="field-label">Exit Price ₹ *</label>
              <input
                type="number"
                value={exitPrice}
                onChange={e => setExitPrice(e.target.value)}
                placeholder="0.00"
                className="field"
                step="0.01"
                required
                autoFocus
              />
            </div>
            <div>
              <label className="field-label">Exit Date</label>
              <input type="date" value={exitDate} onChange={e => setExitDate(e.target.value)} className="field" />
            </div>
          </div>

          <div style={{ marginTop: '12px' }}>
            <label className="field-label">Exit Notes</label>
            <textarea value={exitNotes} onChange={e => setExitNotes(e.target.value)} placeholder="Why did you exit?" className="field" rows={2} style={{ resize: 'none' }} />
          </div>

          {/* P&L Preview */}
          {pnl !== null && (
            <div style={{
              marginTop: '16px',
              padding: '16px',
              borderRadius: '6px',
              background: pnl >= 0 ? 'rgba(0,230,118,0.05)' : 'rgba(255,71,87,0.05)',
              border: `1px solid ${pnl >= 0 ? 'rgba(0,230,118,0.2)' : 'rgba(255,71,87,0.2)'}`,
              textAlign: 'center',
            }}>
              <div style={{ fontSize: '9px', color: 'var(--muted)', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: '6px' }}>Realised P&L</div>
              <div style={{ fontFamily: 'Syne, sans-serif', fontSize: '26px', fontWeight: 700, color: pnl >= 0 ? 'var(--green)' : 'var(--red)' }}>
                {pnl >= 0 ? '+' : '−'}₹{Math.abs(pnl).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
              </div>
              <div style={{ fontSize: '11px', color: pnl >= 0 ? 'var(--green)' : 'var(--red)', opacity: 0.7, marginTop: '2px' }}>
                {pnlPct >= 0 ? '+' : ''}{pnlPct?.toFixed(2)}%
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '20px' }}>
            <button type="button" onClick={onClose} className="btn btn-ghost">Cancel</button>
            <button type="submit" disabled={loading || !exitPrice} className="btn btn-primary">
              {loading ? 'Closing...' : 'Close Trade'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
