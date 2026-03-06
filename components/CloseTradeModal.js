import { useState } from 'react'

const toIndian = (num) => {
  if (!num && num !== 0) return '0'
  return Number(num).toLocaleString('en-IN', { maximumFractionDigits: 2 })
}

export default function CloseTradeModal({ trade, onClose, onConfirm }) {
  const [exitType, setExitType] = useState('full')
  const [exitPrice, setExitPrice] = useState('')
  const [exitQty, setExitQty] = useState('')
  const [exitDate, setExitDate] = useState(new Date().toISOString().slice(0, 10))
  const [exitLearning, setExitLearning] = useState(trade.exit_learning || '')
  const [mistakes, setMistakes] = useState(trade.mistakes || '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const isLong = trade.direction === 'LONG'
  const totalQty = trade.quantity
  const exitPriceNum = parseFloat(exitPrice) || 0
  const partialQtyNum = parseFloat(exitQty) || 0
  const remainingQty = totalQty - partialQtyNum
  const exitQtyForCalc = exitType === 'full' ? totalQty : partialQtyNum

  function calcPnl() {
    if (exitPriceNum <= 0 || exitQtyForCalc <= 0) return null
    if (isLong) return (exitPriceNum - trade.entry_price) * exitQtyForCalc
    return (trade.entry_price - exitPriceNum) * exitQtyForCalc
  }

  function calcPct(pnl) {
    if (pnl === null || !trade.invested_capital) return null
    return (pnl / (trade.invested_capital * (exitQtyForCalc / totalQty))) * 100
  }

  const pnlVal = calcPnl()
  const pctVal = calcPct(pnlVal)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (!exitPrice) return setError('Exit price is required')
    if (exitType === 'partial') {
      if (!exitQty) return setError('Exit quantity is required')
      if (partialQtyNum >= totalQty) return setError('Must be less than total qty')
      if (partialQtyNum <= 0) return setError('Must be greater than 0')
    }
    setLoading(true)
    try {
      if (exitType === 'full') {
        await onConfirm({
          type: 'full',
          updates: {
            exit_price: exitPriceNum,
            exit_date: exitDate,
            exit_learning: exitLearning || null,
            mistakes: mistakes || null,
            status: 'CLOSED',
            realized_gains: pnlVal,
          }
        })
      } else {
        await onConfirm({
          type: 'partial',
          exitQty: partialQtyNum,
          remainingQty: remainingQty,
          updates: {
            exit_price: exitPriceNum,
            exit_date: exitDate,
            exit_learning: exitLearning || null,
            mistakes: mistakes || null,
            status: 'CLOSED',
            realized_gains: pnlVal,
            quantity: partialQtyNum,
          },
          remaining: {
            quantity: remainingQty,
            invested_capital: trade.entry_price * remainingQty,
            actual_investment: trade.actual_investment
              ? (trade.actual_investment / totalQty) * remainingQty : null,
            mtf_value: trade.mtf_value
              ? (trade.mtf_value / totalQty) * remainingQty : null,
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
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: '20px' }}>×</button>
        </div>

        <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
          <button type="button" onClick={() => setExitType('full')} style={{
            flex: 1, padding: '10px', borderRadius: '6px', cursor: 'pointer',
            border: `2px solid ${exitType === 'full' ? 'var(--accent)' : 'var(--border)'}`,
            background: exitType === 'full' ? '#e0f2fe' : 'var(--surface)',
            color: exitType === 'full' ? 'var(--accent)' : 'var(--muted)',
            fontFamily: 'DM Mono, monospace', fontSize: '11px', fontWeight: 700,
          }}>
            ✓ Full Exit
            <div style={{ fontSize: '9px', fontWeight: 400, marginTop: '2px' }}>All {toIndian(totalQty)} shares</div>
          </button>
          <button type="button" onClick={() => setExitType('partial')} style={{
            flex: 1, padding: '10px', borderRadius: '6px', cursor: 'pointer',
            border: `2px solid ${exitType === 'partial' ? '#f59e0b' : 'var(--border)'}`,
            background: exitType === 'partial' ? '#fffbeb' : 'var(--surface)',
            color: exitType === 'partial' ? '#d97706' : 'var(--muted)',
            fontFamily: 'DM Mono, monospace', fontSize: '11px', fontWeight: 700,
          }}>
            ⅓ Partial Exit
            <div style={{ fontSize: '9px', fontWeight: 400, marginTop: '2px' }}>Exit some shares</div>
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="section-divider" style={{ marginTop: 0 }}>Exit Details</div>

          <div style={{ marginBottom: '12px' }}>
            <label className="field-label">Exit Price ₹ *</label>
            <input type="number" value={exitPrice} onChange={e => setExitPrice(e.target.value)}
              placeholder="0.00" className="field" step="0.01" min="0" autoFocus />
          </div>

          {exitType === 'partial' && (
            <div style={{ marginBottom: '12px' }}>
              <label className="field-label">Exit Quantity * (max {toIndian(totalQty)})</label>
              <input type="number" value={exitQty} onChange={e => setExitQty(e.target.value)}
                placeholder={`Max ${totalQty}`} className="field" min="1" max={totalQty - 1} step="1" />
              {partialQtyNum > 0 && partialQtyNum < totalQty && (
                <div style={{ marginTop: '6px', padding: '6px 10px', background: '#f0fdf4', borderRadius: '4px', border: '1px solid #bbf7d0', fontSize: '11px', fontFamily: 'DM Mono, monospace', display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--muted)' }}>Remaining open:</span>
                  <span style={{ color: '#16a34a', fontWeight: 700 }}>{toIndian(remainingQty)} shares</span>
                </div>
              )}
            </div>
          )}

          <div style={{ marginBottom: '12px' }}>
            <label className="field-label">Exit Date</label>
            <input type="date" value={exitDate} onChange={e => setExitDate(e.target.value)} className="field" />
          </div>

          {pnlVal !== null && exitPriceNum > 0 && (
            <div style={{ margin: '14px 0', padding: '14px', borderRadius: '8px', background: pnlVal >= 0 ? '#f0fdf4' : '#fff1f2', border: `1px solid ${pnlVal >= 0 ? '#bbf7d0' : '#fecdd3'}`, textAlign: 'center' }}>
              <div style={{ fontSize: '9px', color: 'var(--muted)', fontFamily: 'DM Mono, monospace', textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: '4px' }}>
                {exitType === 'partial' ? `P&L (${toIndian(exitQtyForCalc)} shares)` : 'Realised P&L'}
              </div>
              <div style={{ fontFamily: 'Noto Sans, sans-serif', fontSize: '26px', fontWeight: 700, color: pnlVal >= 0 ? '#16a34a' : '#dc2626' }}>
                {pnlVal >= 0 ? '+' : '−'}₹{toIndian(Math.abs(pnlVal))}
              </div>
              {pctVal !== null && (
                <div style={{ fontSize: '12px', color: pnlVal >= 0 ? '#16a34a' : '#dc2626', marginTop: '2px', fontFamily: 'Noto Sans, sans-serif' }}>
                  {pctVal >= 0 ? '+' : ''}{pctVal.toFixed(2)}%
                </div>
              )}
            </div>
          )}

          <div className="section-divider">Post-Trade Review</div>
          <div style={{ marginBottom: '12px' }}>
            <label className="field-label">What I Learned</label>
            <textarea value={exitLearning} onChange={e => setExitLearning(e.target.value)}
              placeholder="What did this trade teach you?" className="field" rows={2} style={{ resize: 'vertical' }} />
          </div>
          <div style={{ marginBottom: '4px' }}>
            <label className="field-label">Mistakes Made</label>
            <textarea value={mistakes} onChange={e => setMistakes(e.target.value)}
              placeholder="What went wrong?" className="field" rows={2} style={{ resize: 'vertical' }} />
          </div>

          {error && (
            <div style={{ marginTop: '10px', padding: '8px 12px', background: '#fee2e2', borderRadius: '4px', color: '#dc2626', fontSize: '11px', fontFamily: 'DM Mono, monospace' }}>
              {error}
            </div>
          )}

          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '20px' }}>
            <button type="button" onClick={onClose} className="btn btn-ghost">Cancel</button>
            <button type="submit" disabled={loading || !exitPrice} className="btn btn-primary"
              style={exitType === 'partial' ? { background: '#f59e0b' } : {}}>
              {loading ? 'Processing...' : exitType === 'full' ? '✓ Close Trade' : '⅓ Partial Exit'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
