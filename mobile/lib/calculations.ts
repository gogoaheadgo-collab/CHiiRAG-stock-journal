// Shared P&L and quantity calculations — used by dashboard, accounts, trades.
// All functions accept pre-filtered execs for a single trade (tradeExecs),
// NOT the full flat executions array — caller must filter by trade.id first.

export function getCurrentQty(trade: any, tradeExecs: any[]): number {
  const soldQty = tradeExecs.reduce((s, e) => s + Number(e.quantity || 0), 0)
  return Math.max(0, Number(trade.quantity || 0) - soldQty)
}

export function getUnrealisedPnl(trade: any, tradeExecs: any[], cmp: number): number {
  if (!cmp || (trade.status || '').toUpperCase() !== 'OPEN') return 0
  const currQty = getCurrentQty(trade, tradeExecs)
  if (currQty <= 0) return 0
  return trade.direction === 'SHORT'
    ? (Number(trade.entry_price) - cmp) * currQty
    : (cmp - Number(trade.entry_price)) * currQty
}

export function getRealisedPnl(trade: any, tradeExecs: any[]): number {
  return tradeExecs.reduce((s, e) =>
    s + (Number(e.price) - Number(trade.entry_price)) * Number(e.quantity), 0)
}

export function getMtfInterest(trade: any): number {
  if (!trade.mtf_interest_rate || !trade.entry_date) return 0
  const totalVal = Number(trade.invested_capital) || (Number(trade.entry_price) * Number(trade.quantity))
  if (!totalVal) return 0
  const margin = Number(trade.actual_investment) || 0
  const base = margin > 0 ? totalVal - margin : totalVal
  if (base <= 0) return 0
  const end = (trade.status || '').toUpperCase() === 'CLOSED' && trade.exit_date
    ? new Date(trade.exit_date) : new Date()
  const start = new Date(trade.entry_date)
  const days = Math.max(1, Math.floor((end.getTime() - start.getTime()) / 86400000))
  return (base * Number(trade.mtf_interest_rate) * days) / 36500
}
