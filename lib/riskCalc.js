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
    sellPrice, sellDate, live, sellValue,
    netBuy, netSell: isOpen ? null : sellValue,
    dma20: num(input?.dma20), dma50: num(input?.dma50),
    mtf, netPL, plPct,
    netBuyPrice: qty > 0 ? netBuy / qty : null,
    netSellPrice: sellPrice,
    days, slPct, grossR, netR,
    mae: num(input?.mae),
  }
}

const INPUT_FIELDS = ['risk_pct', 'stop_loss', 'setup', 'dma20', 'dma50', 'mae', 'sl_pct', 'rf_rr']
function mergeInputs(inputs, ids) {
  const out = {}
  INPUT_FIELDS.forEach(f => {
    for (const id of ids) {
      const v = inputs[id]?.[f]
      if (v !== null && v !== undefined && v !== '') { out[f] = v; break }
    }
  })
  return out
}

// ── Ticker-wise positions ──
// A position = one ticker across every account in the portfolio, from first buy until all of
// its trades are closed. A buy after everything was sold starts a new position. Buys on later
// dates while the position is open are pyramids (same-day buys in several accounts = one entry).
// `trades` should include excluded trades so a position's anchor (and its saved inputs) stays stable.
export function buildPositions(trades, execsByTrade, inputs, livePrices, excluded, portfolioSize) {
  const exitOf = t => {
    if (t.status !== 'CLOSED') return null
    const ex = execsByTrade[t.id] || []
    const last = ex.reduce((d,e) => (!d || e.date > d) ? e.date : d, null)
    const d = [t.exit_date, last].filter(Boolean).map(x => String(x).slice(0,10)).sort().pop()
    return d || String(t.entry_date).slice(0,10)
  }
  const byTicker = {}
  trades.forEach(t => { (byTicker[t.ticker] = byTicker[t.ticker] || []).push(t) })

  const groups = []
  Object.values(byTicker).forEach(list => {
    list.sort((a,b) => String(a.entry_date).localeCompare(String(b.entry_date)) || String(a.created_at).localeCompare(String(b.created_at)))
    let cur = null
    list.forEach(t => {
      const entry = String(t.entry_date).slice(0,10)
      // New position only when every trade so far is closed and this buy comes after the last exit
      if (!cur || (cur.allClosed && entry > cur.lastExit)) { cur = { trades: [], allClosed: true, lastExit: '' }; groups.push(cur) }
      cur.trades.push(t)
      const ex = exitOf(t)
      if (!ex) cur.allClosed = false
      else if (ex > cur.lastExit) cur.lastExit = ex
    })
  })

  const size = Number(portfolioSize) > 0 ? Number(portfolioSize) : null
  const positions = []
  groups.forEach(g => {
    const anchor = g.trades[0]
    const dates = [...new Set(g.trades.map(t => String(t.entry_date).slice(0,10)))].sort()
    // Inputs may have been typed on any account's trade (in another portfolio the position starts
    // from a different trade), so take each field from the first leg that has it
    const initialIds = g.trades.filter(t => String(t.entry_date).slice(0,10) === dates[0]).map(t => t.id)
    const input = mergeInputs(inputs, initialIds)
    const legs = g.trades.map(t => {
      const leg = buildRow(t, execsByTrade[t.id] || [], undefined, livePrices[t.ticker])
      const n = dates.indexOf(leg.buyDate)
      return { ...leg, entryLabel: n <= 0 ? 'Initial' : `Pyramid ${n}`, excluded: excluded.has(t.id) }
    })
    const active = legs.filter(l => !l.excluded)
    if (active.length === 0) return

    const isOpen = active.some(l => l.status === 'Open')
    const qty = active.reduce((s,l) => s + l.qty, 0)
    const netBuy = active.reduce((s,l) => s + l.netBuy, 0)
    const buy = qty > 0 ? netBuy / qty : 0
    const sellValue = active.every(l => l.sellValue !== null) ? active.reduce((s,l) => s + l.sellValue, 0) : null
    const mtf = active.reduce((s,l) => s + (l.mtf || 0), 0)
    const buyDate = active.map(l => l.buyDate).filter(Boolean).sort()[0] || null
    const sellDate = isOpen ? null : (active.map(l => l.sellDate).filter(Boolean).sort().pop() || null)
    const sellPrice = sellValue !== null && qty > 0 ? sellValue / qty : null
    const netPL = sellValue !== null ? sellValue - netBuy - mtf : null
    const plPct = netPL !== null && netBuy > 0 ? netPL / netBuy : null
    const daysTo = sellDate || (isOpen ? new Date().toISOString().slice(0,10) : null)
    const days = daysTo && buyDate ? Math.round((new Date(daysTo) - new Date(buyDate)) / DAY_MS) : null
    const riskPct = num(input?.risk_pct)
    const riskAmt = riskPct !== null && size ? riskPct / 100 * size : null
    const rfRR = num(input?.rf_rr)
    const cmp = livePrices[anchor.ticker] || null

    // Tranches: Initial = first buy date, then Pyramid 1, 2… (same-day buys across accounts = one tranche)
    const trancheMap = {}
    active.forEach(l => { (trancheMap[l.buyDate] = trancheMap[l.buyDate] || []).push(l) })
    const tranches = Object.keys(trancheMap).sort().map((d, i) => {
      const tl = trancheMap[d]
      const tq = tl.reduce((s2,l) => s2 + l.qty, 0)
      const tb = tq > 0 ? tl.reduce((s2,l) => s2 + l.netBuy, 0) / tq : 0
      const openQty = tl.filter(l => l.status === 'Open').reduce((s2,l) => s2 + l.qty, 0)
      return { key: tl[0].id, label: i === 0 ? 'Initial' : `Pyramid ${i}`, date: d, qty: tq, buy: tb, openQty, legIds: tl.map(l => l.id) }
    })
    tranches.forEach((t, i) => {
      if (i === 0) {
        // Initial SL % = Risk ₹ × 100 ÷ (buy × qty), unless overridden
        t.slPctAuto = riskAmt !== null && t.buy * t.qty > 0 ? riskAmt * 100 / (t.buy * t.qty) : null
        t.slPct = num(input?.sl_pct) ?? t.slPctAuto
        t.risk = riskAmt                                   // open risk while not risk-free = Risk ₹
      } else {
        t.slPct = num(mergeInputs(inputs, t.legIds).sl_pct)  // entered per pyramid
        t.risk = t.slPct !== null ? t.slPct / 100 * t.buy * t.qty : null
      }
      t.slPrice = t.slPct !== null ? t.buy * (1 - t.slPct / 100) : null
      t.slRisk = t.slPct !== null ? t.slPct / 100 * t.buy * t.qty : null
      // Live tranche R:R = (CMP − buy) ÷ (buy × SL %)
      t.rr = t.openQty > 0 && cmp && t.slPct ? (cmp - t.buy) / (t.buy * t.slPct / 100) : null
      t.riskFree = rfRR !== null && t.rr !== null && t.rr >= rfRR
      t.openRisk = t.openQty > 0 ? (t.riskFree ? 0 : t.risk) : 0
    })
    const initial = tranches[0]
    const sl = initial?.slPrice ?? null
    const slPct = initial?.slPct !== null && initial?.slPct !== undefined ? -initial.slPct / 100 : null
    const slRisk = tranches.every(t => t.slRisk !== null) ? tranches.reduce((s2,t) => s2 + t.slRisk, 0) : null
    const rr = netPL !== null && slRisk > 0 ? netPL / slRisk : null
    const grossR = plPct !== null && slPct ? plPct / Math.abs(slPct) : null
    const netR = grossR !== null && riskPct !== null ? grossR * riskPct : null
    const openRiskUnknown = isOpen && tranches.some(t => t.openQty > 0 && t.openRisk === null)
    const openRisk = isOpen ? tranches.reduce((s2,t) => s2 + (t.openRisk || 0), 0) : 0
    const accounts = [...new Set(active.map(l => l.account).filter(Boolean))]

    positions.push({
      id: anchor.id,
      initialIds,
      tradeIds: active.map(l => l.id),
      legs: legs.map(l => {
        const t = tranches.find(t2 => t2.legIds.includes(l.id))
        return { ...l, tranche: t, trancheFirst: t ? t.legIds[0] === l.id : false }
      }),
      tranches,
      pyramids: dates.length - 1,
      month: buyDate ? MONTH_NAMES[Number(buyDate.slice(5,7)) - 1] : '',
      account: accounts.join(', '),
      accountCount: accounts.length,
      status: isOpen ? 'Open' : 'Closed',
      symbol: anchor.ticker,
      setup: input?.setup ?? tradeSetup(anchor),
      tradeSetup: tradeSetup(anchor),
      riskPct, riskAmt, rfRR, openRisk, openRiskUnknown,
      slPctAuto: initial?.slPctAuto ?? null,
      slPctOverridden: num(input?.sl_pct) !== null,
      qty, buy, buyDate, sl,
      tradeSL: num(anchor.stop_loss),
      sellPrice, sellDate, live: active.some(l => l.live), sellValue,
      netBuy, netSell: isOpen ? null : sellValue,
      dma20: num(input?.dma20), dma50: num(input?.dma50),
      mtf, netPL, plPct,
      netBuyPrice: qty > 0 ? buy : null,
      netSellPrice: sellPrice,
      days, slPct, slRisk, rr, grossR, netR,
      mae: num(input?.mae),
    })
  })
  // Open positions first, closed at the bottom; each group by buy date
  positions.sort((a,b) => (a.status === b.status ? 0 : a.status === 'Open' ? -1 : 1) || String(a.buyDate).localeCompare(String(b.buyDate)) || a.symbol.localeCompare(b.symbol))
  return positions
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
  // Open risk: only open positions; tranches past their risk-free R:R count 0
  const openRisk = open.reduce((s,r) => s + (r.openRisk || 0), 0)
  const openRiskPct = open.reduce((s,r) => s + (r.riskPct || 0), 0)
  const riskFreeCount = open.filter(r => r.tranches && r.tranches.every(t => t.openQty === 0 || t.riskFree)).length

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
    openMissingSL: open.filter(r => r.openRiskUnknown).length,
    riskFreeCount,
    capital,
    bySetup,
  }
}
