import { useState } from 'react'

export default function ExitTradeModal({ trade, onClose, onConfirm }) {
  const [exitPrice, setExitPrice] = useState('')
  const [exitQty, setExitQty] = useState('')
  const [exitDate, setExitDate] = useState(new Date().toISOString().slice(0, 10))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const entryPrice = parseFloat(trade.entry_price) || 0
  const totalQty = parseFloat(trade.quantity) || 0
  const exitPriceNum = parseFloat(exitPrice) || 0
  const eq = parseFloat(exitQty) || 0
  const remainingQty = totalQty - eq

  const realisedGain = exitPriceNum && eq
    ? trade.direction === 'LONG'
      ? (exitPriceNum - entryPrice) * eq
      : (entryPrice - exitPriceNum) * eq
    : null

  const unrealisedGain = exitPriceNum && eq && remainingQty > 0
    ? trade.direction === 'LONG'
      ? (exitPriceNum - entryPrice) * remainingQty
      : (entryPrice - exitPriceNum) * remainingQty
    : null

  const isFullExit = eq >= totalQty

  const fmt = (n) => Math.abs(n).toLocaleString('en-IN', { maximumFractionDigits: 2 })
  const sign = (n) => n >= 0 ? '+' : '−'
  const col = (n) => n >= 0 ? 'var(--bull, #16a34a)' : 'var(--bear, #dc2626)'

  const handleSubmit = async () => {
    setError('')
    if (!exitPrice || !exitQty || !exitDate) return setError('All fields required')
    if (eq <= 0) return setError('Exit quantity must be greater than 0')
    if (eq > totalQty) return setError(`Cannot exit more than ${totalQty} shares`)

    setLoading(true)
    try {
      await onConfirm({
        exitPrice: exitPriceNum,
        exitQty: eq,
        exitDate,
        realisedGain,
        remainingQty,
        isFullExit,
      })
      onClose()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const inputStyle = {
    width: '100%', background: 'var(--surface2, #f1f5f9)',
    border: '1px solid var(--border, #e2e8f0)', borderRadius: '6px',
    padding: '9px 12px', color: 'var(--text, #1a1f36)',
    fontSize: '13px', fontFamily: 'DM Mono, Courier New, monospace', outline: 'none',
  }
  const labelStyle = {
    fontSize: '11px', color: 'var(--muted, #6b7a9e)', fontWeight: 600,
    letterSpacing: '0.08em', marginBottom: '5px', display: 'block',
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
    }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{
        background: 'var(--bg, #fff)', border: '1px solid var(--border, #e2e8f0)',
        borderRadius: '12px', padding: '28px', width: '100%', maxWidth: '460px',
        boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div>
            <div style={{ fontFamily: 'Bookman Old Style, Libre Baskerville, Georgia, serif', fontWeight: 700, fontSize: '18px', color: 'var(--text)' }}>
              Exit Trade
            </div>
            <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '2px' }}>
              {trade.ticker} · {trade.direction} · {totalQty} shares @ Rs{entryPrice.toLocaleString('en-IN')}
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '20px', color: 'var(--muted)', cursor: 'pointer' }}>×</button>
        </div>

        {/* Fields */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={labelStyle}>EXIT PRICE *</label>
            <input type="number" value={exitPrice} onChange={e => setExitPrice(e.target.value)}
              placeholder="Enter exit price" style={inputStyle} autoFocus />
          </div>
          <div>
            <label style={labelStyle}>EXIT QUANTITY * (max: {totalQty})</label>
            <input type="number" value={exitQty} onChange={e => setExitQty(e.target.value)}
              placeholder={`Enter qty (max ${totalQty})`} style={inputStyle} max={totalQty} />
          </div>
          <div>
            <label style={labelStyle}>EXIT DATE *</label>
            <input type="date" value={exitDate} onChange={e => setExitDate(e.target.value)} style={inputStyle} />
          </div>
        </div>

        {/* P&L Preview */}
        {exitPriceNum > 0 && eq > 0 && (
          <div style={{
            marginTop: '18px', background: 'var(--surface, #f8f9fc)',
            border: '1px solid var(--border)', borderRadius: '8px', padding: '14px',
          }}>
            <div style={{ fontSize: '10px', color: 'var(--muted)', letterSpacing: '0.1em', fontWeight: 600, marginBottom: '10px' }}>
              P&L PREVIEW
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px', fontFamily: 'DM Mono, monospace' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--muted)' }}>Realised ({eq} shares)</span>
                <span style={{ fontWeight: 700, color: col(realisedGain) }}>
                  {sign(realisedGain)}Rs{fmt(realisedGain)}
                </span>
              </div>
              {!isFullExit && unrealisedGain !== null && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--muted)' }}>Unrealised ({remainingQty} remaining)</span>
                  <span style={{ fontWeight: 700, color: col(unrealisedGain) }}>
                    {sign(unrealisedGain)}Rs{fmt(unrealisedGain)}
                  </span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '6px', borderTop: '1px solid var(--border)' }}>
                <span style={{ color: 'var(--muted)' }}>Type</span>
                <span style={{ fontWeight: 700, color: isFullExit ? 'var(--bear, #dc2626)' : 'var(--accent, #0ea5e9)' }}>
                  {isFullExit ? 'Full Exit' : 'Partial Exit'}
                </span>
              </div>
            </div>
          </div>
        )}

        {error && <div style={{ color: 'var(--bear, #dc2626)', fontSize: '12px', marginTop: '10px' }}>{error}</div>}

        {/* Buttons */}
        <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
          <button onClick={onClose} style={{
            flex: 1, padding: '10px', background: 'var(--surface)',
            border: '1px solid var(--border)', borderRadius: '6px',
            color: 'var(--muted)', cursor: 'pointer', fontSize: '13px',
          }}>Cancel</button>
          <button onClick={handleSubmit} disabled={loading} style={{
            flex: 2, padding: '10px', borderRadius: '6px', border: 'none',
            background: 'var(--accent, #0ea5e9)', color: '#fff',
            fontWeight: 700, fontSize: '13px', cursor: 'pointer',
          }}>
            {loading ? 'Saving...' : isFullExit ? 'Confirm Full Exit' : 'Confirm Partial Exit'}
          </button>
        </div>
      </div>
    </div>
  )
}
