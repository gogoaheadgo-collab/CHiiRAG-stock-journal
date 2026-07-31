export function calculateMfeMae({ direction, entryPrice, initialStopLoss, bars }) {
  if (bars.length === 0) return { mfe: null, mae: null, mfeR: null, maeR: null }

  const highestHigh = Math.max(...bars.map(b => b.high))
  const lowestLow = Math.min(...bars.map(b => b.low))

  let mfe, mae
  if (direction === 'SHORT') {
    mfe = entryPrice - lowestLow
    mae = highestHigh - entryPrice
  } else {
    mfe = highestHigh - entryPrice
    mae = entryPrice - lowestLow
  }

  const risk = initialStopLoss != null ? Math.abs(entryPrice - initialStopLoss) : null
  const mfeR = risk ? mfe / risk : null
  const maeR = risk ? mae / risk : null

  return { mfe, mae, mfeR, maeR }
}
