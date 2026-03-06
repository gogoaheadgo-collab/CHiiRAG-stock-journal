import { useState } from 'react'

const toIndian = (num) => {
  if (!num && num !== 0) return ''
  return Number(num).toLocaleString('en-IN', { maximumFractionDigits: 2 })
}

export default function CloseTradeModal({ trade, onClose, onConfirm }) {
  const [exitType, setExitType] = useState('full') // 'full' | 'partial'
  const [exitPrice, setExitPrice] = useState('')
  const [exitQty, setExitQty] = useState('')
  const [exitDate, setExitDate] = useState(new Date().toISOString().slice(0, 10))
  const [exitLearning, setExitLearning] = useState(trade.exit_learning || '')
  const [mistakes, setMistakes] = useState(trade.mistakes || '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const isLong = trade.direction === 'LONG'
  const exitPriceNum = parseFloat(exitPrice) || 0
  const totalQty = trade.quantity
  const partialQty = parseFloat(exitQty) || 0
  const remainingQty = totalQty - partialQty

  // P&L calculation
  const exitQtyForCalc = exitType === 'full' ? totalQty : partialQty
  const pnl = exitPriceNum > 0
    ? isLong
      ? (exitPriceNum - trade.entry_price) * exitQtyForCalc
      : (trade.entry_price - exitPriceNum) * exitQtyForCalc
    : null

  const pnlPct = pnl !== null && trade.invested_capital > 0
    ? (pnl / (trade.invested_capital * (exitQtyForCalc / totalQty))) * 100
    : null

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (!exitPrice) return setError('Exit price is required')

    if (exitType === 'partial') {
      if (!exitQty) return setError('Exit quantity is required for partial exit')
      if (partialQty >= totalQty) return setError(`Quantity must be less than total (${toIndian(totalQty)})`)
      if (partialQty <= 0) return setError('Exit quantity must be greater than 0')
    }

    setLoading(true)
    try {
      if (exitType === 'full') {
        // Full exit — update existing trade to CLOSED
        await onConfirm({
          type: 'full',
          updates: {
            exit_price: exitPriceNum,
            exit_date: exitDate,
            exit_learning: exitLearning || null,
            mistakes: mistakes || null,
            status: 'CLOSED',
            realized_gains: pnl,
          }
        })
      } else {
        // Partial exit — close partial qty, keep remaining open
        await onConfirm({
          type: 'partial',
          exitQty: partialQty,
          remainingQty,
          updates: {
            exit_price: exitPriceNum,
            exit_date: exitDate,
            exit_learning: exitLearning || null,
            mistakes: mistakes || null,
            status: 'CLOSED',
            realized_gains: pnl,
            quantity: partialQty, // closed portion qty
          },
          remaining: {
            // Keep remaining as new OPEN trade
            quantity: remainingQty,
            invested_capital: trade.entry_price * remainingQty,
            actual_investment: trade.actual_investment
              ? (trade.actual_investment / totalQty) * remainingQty
              : null,
            mtf_value: trade.mtf_value
              ? (trade.mtf_value / totalQty) * remainingQty
              : null,
          }
        })
      }
      onClose()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: '460px' }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div>
            <div className="modal-title" style={{ marginBottom: '4px' }}>Exit Trade — {trade.ticker}</div>
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              <span className={`badge badge-${trade.direction.toLowerCase()}`}>{trade.direction}</span>
              <span style={{ fontSize: '11px', color: 'var(--muted)', fontFamily: 'Noto Sans, sans-serif' }}>
                {toIndian(trade.quantity)} shares @ ₹{toIndian(trade.entry_price)}
              </span>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: '20px', lineHeight: 1 }}>×</button>
        </div>

        {/* Exit Type Toggle */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
          <button
            type="button"
            onClick={() => setExitType('full')}
            style={{
              flex: 1, padding: '10px', borderRadius: '6px', cursor: 'pointer',
              border: `2px solid ${exitType === 'full' ? 'var(--accent)' : 'var(--border)'}`,
              background: exitType === 'full' ? '#e0f2fe' : 'var(--surface)',
              color: exitType === 'full' ? 'var(--accent)' : 'var(--muted)',
              fontFamily: 'DM Mono, monospace', fontSize: '11px', fontWeight: 700,
              transition: 'all 0.15s', textAlign: 'center',
            }}
          >
            ✓ Full Exit
            <div style={{ fontSize: '9px', fontWeight: 400, marginTop: '2px', opacity: 0.8 }}>
              All {toIndian(totalQty)} shares
            </div>
          </button>
          <button
            type="button"
            onClick={() => setExitType('partial')}
            style={{
              flex: 1, padding: '10px', borderRadius: '6px', cursor: 'pointer',
              border: `2px solid ${exitType === 'partial' ? '#f59e0b' : 'var(--border)'}`,
              background: exitType === 'partial' ? '#fffbeb' : 'var(--surface)',
              color: exitType === 'partial' ? '#d97706' : 'var(--muted)',
              fontFamily: 'DM Mono, monospace', fontSize: '11px', fontWeight: 700,
              transition: 'all 0.15s', textAlign: 'center',
            }}
          >
            ⅓ Partial Exit
            <div style={{ fontSize: '9px', fontWeight: 400, marginTop: '2px', opacity: 0.8 }}>
              Exit some shares
            </div>
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="section-divider" style={{ marginTop: 0 }}>Exit Details</div>

          {/* Exit Price — always shown */}
          <div style={{ marginBottom: '12px' }}>
            <label className="field-label">Exit Price ₹ *</label>
            <input
              type="number" value={exitPrice}
              onChange={e => setExitPrice(e.target.value)}
              placeholder="0.00" className="field" step="0.01" min="0" required autoFocus
            />
          </div>

          {/* Partial exit — show qty field */}
          {exitType === 'partial' && (
            <div style={{ marginBottom: '12px' }}>
              <label className="field-label">Exit Quantity * <span style={{ color: 'var(--muted)', fontWeight: 400 }}>(max {toIndian(totalQty)})</span></label>
              <input
                type="number" value={exitQty}
                onChange={e => setExitQty(e.target.value)}
                placeholder={`Max ${totalQty}`} className="field"
                min="1" max={totalQty - 1} step="1"
              />
              {partialQty > 0 && partialQty < totalQty && (
                <div style={{ marginTop: '8px', padding: '8px 12px', background: '#f0fdf4', borderRadius: '4px', border: '1px solid #bbf7d0', display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontFamily: 'DM Mono, monospace' }}>
                  <span style={{ color: 'var(--muted)' }}>Remaining open:</span>
                  <span style={{ color: '#16a34a', fontWeight: 700 }}>{toIndian(remainingQty)} shares</span>
                </div>
              )}
            </div>
          )}

          {/* Exit Date */}
          <div style={{ marginBottom: '12px' }}>
            <label className="field-label">Exit Date</label>
            <input type="date" value={exitDate} onChange={e => setExitDate(e.target.value)} className="field" />
          </div>

          {/* P&L Preview */}
          {pnl !== null && exitPriceNum > 0 && (
            <div style={{
              margin: '14px 0',
              padding: '14px',
              borderRadius: '8px',
              background: pnl >= 0 ? '#f0fdf4' : '#fff1f2',
              border: `1px solid ${pnl >= 0 ? '#bbf7d0' : '#fecdd3'}`,
              textAlign: 'center',
            }}>
              <div style={{ fontSize: '9px', color: 'var(--muted)', fontFamily: 'DM Mono, monospace', textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: '4px' }}>
                {exitType === 'partial' ? `Realised P&L (${toIndian(exitQtyForCalc)} shares)` : 'Realised P&L'}
              </div>
              <div style={{ fontFamily: 'Noto Sans, sans-serif', fontSize: '26px', fontWeight: 700, color: pnl >= 0 ? '#16a34a' : '#dc2626' }}>
                {pnl >= 0 ? '+' : '−'}₹{toIndian(Math.abs(pnl))}
              </div>
              {pnlPct !== null && (
                <div style={{ fontSize: '12px', color: pnl >= 0 ? '#16a34a' : '#dc2626', marginTop: '2px', fontFamily: 'Noto Sans, sans-serif' }}>
                  {pnlPct >= 0 ? '+' : ''}{pnlPct.toFixed(2)}%
                </div>
              )}
            </div>
          )}

          {/* Post-trade notes */}
          <div className="section-divider">Post-Trade Review</div>
          <div style={{ marginBottom: '12px' }}>
            <label className="field-label">What I Learned</label>
            <textarea value={exitLearning} onChange={e => setExitLearning(e.target.value)} placeholder="What did this trade teach you?" className="field" rows={2} style={{ resize: 'vertical' }} />
          </div>
          <div style={{ marginBottom: '4px' }}>
            <label className="field-label">Mistakes Made</label>
            <textarea value={mistakes} onChange={e => setMistakes(e.target.value)} placeholder="Did you break your rules? What went wrong?" className="field" rows={2} style={{ resize: 'vertical' }} />
          </div>

          {error && (
            <div style={{ marginTop: '10px', padding: '8px 12px', background: '#fee2e2', borderRadius: '4px', color: '#dc2626', fontSize: '11px', fontFamily: 'DM Mono, monospace' }}>
              {error}
            </div>
          )}

          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '20px' }}>
            <button type="button" onClick={onClose} className="btn btn-ghost">Cancel</button>
            <button type="submit" disabled={loading || !exitPrice} className="btn btn-primary" style={exitType === 'partial' ? { background: '#f59e0b' } : {}}>
              {loading ? 'Processing...' : exitType === 'full' ? '✓ Close Trade' : '⅓ Partial Exit'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
