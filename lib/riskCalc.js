// Risk Management calculations — shared by the page and the Excel export.
// Formulas follow the specimen sheet, with the Gross R sign fixed (losses are negative).

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December']
const DAY_MS = 86400000

const num = v => (v === null || v === undefined || v === '' || isNaN(Number(v))) ? null : Number(v)

// MTF interest accrued on a trade — same method as the Accounts page CSV export
function mtfInterest(t, execs) {
  const origQty = Number(t.quantity) || 0
  const investment = Number(t.invested_capital) || (Number(t.entry_price) * origQty)
  const mtfBase = investment - (Number(t.actual_investment) || 0)
  if (!(mtfBase > 0) || !t.mtf_interest_rate || !t.entry_date || origQty <= 0) return 0
  const rate = Number(t.mtf_interest_rate)
  const totalSold = execs.reduce((s,e) => s + Number(e.quantity), 0)
  const currQty = Math.max(0, origQty - totalSold)
  const soldM = execs.reduce((s,e) => {
    const d = Math.max(1, Math.floor((new Date(e.date) - new Date(t.entry_date)) / DAY_MS))
    return s + mtfBase * (Number(e.quantity) / origQty) * rate * d / 36500
  }, 0)
  const endDate = t.status === 'CLOSED' && t.exit_date ? new Date(t.exit_date) : new Date()
  const remD = Math.max(1, Math.floor((endDate - new Date(t.entry_date)) / DAY_MS))
  const remM = currQty > 0 ? mtfBase * (currQty / origQty) * rate * remD / 36500 : 0
  return soldM + remM
}

const tradeSetup = t => t.setup_pattern || (t.notes ? String(t.notes).split(' | ')[0] : '') || ''

// One display row per trade. `input` is the saved risk_trade_inputs row (or undefined).
export function buildRow(t, execs, input, cmp) {
  const qty = Number(t.quantity) || 0
  const buy = Number(t.entry_price) || 0
  const isOpen = t.status !== 'CLOSED'
  const soldQty = execs.reduce((s,e) => s + Number(e.quantity), 0)
  const soldValue = execs.reduce((s,e) => s + Number(e.price) * Number(e.quantity), 0)
  const lastExecDate = execs.reduce((d,e) => (!d || e.date > d) ? e.date : d, null)

  let sellValue = null, sellDate = null, live = false
  if (!isOpen) {
    if (execs.length > 0 && soldQty > 0) {
      // Weighted average of all exits; any unsold remainder is valued at the trade's exit price
      const rem = Math.max(0, qty - soldQty)
      sellValue = soldValue + rem * (num(t.exit_price) ?? (soldValue / soldQty))
      sellDate = (t.exit_date && (!lastExecDate || t.exit_date > lastExecDate)) ? t.exit_date : lastExecDate
    } else if (num(t.exit_price) !== null) {
      sellValue = Number(t.exit_price) * qty
      sellDate = t.exit_date
    }
  } else if (cmp) {
    // Open: remaining qty marked at live CMP, sold part at its actual exit prices
    sellValue = soldValue + Math.max(0, qty - soldQty) * cmp
    live = true  // Sell Date / Net Sell Value stay blank; days run to today
  }
  sellDate = sellDate ? String(sellDate).slice(0,10) : null

  const riskPct = num(input?.risk_pct)
  const sl = num(input?.stop_loss)
  const netBuy = qty * buy
  const sellPrice = sellValue !== null && qty > 0 ? sellValue / qty : null
  const mtf = mtfInterest(t, execs)
  const netPL = sellValue !== null ? sellValue - netBuy - mtf : null
  const plPct = netPL !== null && netBuy > 0 ? netPL / netBuy : null
  const daysTo = sellDate || (isOpen ? new Date().toISOString().slice(0,10) : null)
  const days = daysTo && t.entry_date ? Math.round((new Date(daysTo) - new Date(String(t.entry_date).slice(0,10))) / DAY_MS) : null
  const slPct = sl ? 1 - buy / sl : null
  const grossR = plPct !== null && slPct ? plPct / Math.abs(slPct) : null
  const netR = grossR !== null && riskPct !== null ? grossR * riskPct : null
  const buyDate = t.entry_date ? String(t.entry_date).slice(0,10) : null

  return {
    id: t.id,
    trade: t,
    month: buyDate ? MONTH_NAMES[Number(buyDate.slice(5,7)) - 1] : '',
    account: t._accountLabel || t.account || '',
    status: isOpen ? 'Open' : 'Closed',
    symbol: t.ticker,
    setup: input?.setup ?? tradeSetup(t),
    tradeSetup: tradeSetup(t),
    riskPct, qty, buy, buyDate, sl,
    tradeSL: num(t.stop_loss),
    sellPrice, sellDate, live,
    netBuy, netSell: isOpen ? null : sellValue,
    dma20: num(input?.dma20), dma50: num(input?.dma50),
    mtf, netPL, plPct,
    netBuyPrice: qty > 0 ? netBuy / qty : null,
    netSellPrice: sellPrice,
    days, slPct, grossR, netR,
    mae: num(input?.mae),
  }
}

const avg = a => a.length ? a.reduce((s,x) => s + x, 0) / a.length : null

// Summary for one portfolio. capital = sum of member accounts' capital (net deposits + realised P/L).
export function summarize(rows, capital) {
  const closed = rows.filter(r => r.status === 'Closed' && r.netPL !== null)
  const wins = closed.filter(r => r.netPL > 0)
  const losses = closed.filter(r => r.netPL <= 0)
  const avgWin = avg(wins.map(r => r.plPct).filter(x => x !== null))
  const avgLoss = avg(losses.map(r => r.plPct).filter(x => x !== null))
  const rs = closed.map(r => r.grossR).filter(x => x !== null)
  const netRs = closed.map(r => r.netR).filter(x => x !== null)

  const open = rows.filter(r => r.status === 'Open')
  const openWithSL = open.filter(r => r.sl !== null)
  const openRisk = openWithSL.reduce((s,r) => s + (r.buy - r.sl) * r.qty, 0)
  const openRiskPct = open.reduce((s,r) => s + (r.riskPct || 0), 0)

  const setups = {}
  closed.forEach(r => {
    const k = r.setup || '—'
    if (!setups[k]) setups[k] = []
    setups[k].push(r)
  })
  const bySetup = Object.entries(setups).map(([setup, rs2]) => ({
    setup,
    trades: rs2.length,
    winRate: rs2.filter(r => r.netPL > 0).length / rs2.length,
    avgPL: avg(rs2.map(r => r.plPct).filter(x => x !== null)),
    avgR: avg(rs2.map(r => r.grossR).filter(x => x !== null)),
    netPL: rs2.reduce((s,r) => s + r.netPL, 0),
  })).sort((a,b) => b.trades - a.trades)

  return {
    closedCount: closed.length,
    openCount: open.length,
    winRate: closed.length ? wins.length / closed.length : null,
    avgWin, avgLoss,
    winLossRatio: avgWin !== null && avgLoss ? avgWin / Math.abs(avgLoss) : null,
    totalPL: closed.reduce((s,r) => s + r.netPL, 0),
    totalNetR: netRs.length ? netRs.reduce((s,x) => s + x, 0) : null,
    avgGrossR: avg(rs),
    expectancy: avg(rs),
    bestR: rs.length ? Math.max(...rs) : null,
    worstR: rs.length ? Math.min(...rs) : null,
    openRisk,
    openRiskOfCapital: capital > 0 ? openRisk / capital : null,
    openRiskPct,
    openMissingSL: open.length - openWithSL.length,
    capital,
    bySetup,
  }
}
