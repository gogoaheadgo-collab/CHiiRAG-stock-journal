// Excel export for Risk Management — every computed column is a live Excel formula.
// Each formula also carries the value computed in the app as its cached result.

export const COLUMNS = [
  { key:'sr',          label:'Sr. No',         width:7 },
  { key:'month',       label:'Month',          width:11 },
  { key:'account',     label:'Account',        width:16 },
  { key:'status',      label:'Open/ Closed',   width:11 },
  { key:'symbol',      label:'Symbol',         width:14 },
  { key:'setup',       label:'Setup',          width:12 },
  { key:'riskPct',     label:'Risk %',         width:8 },
  { key:'qty',         label:'Quantity',       width:10 },
  { key:'buy',         label:'Buy Price',      width:11 },
  { key:'buyDate',     label:'Buy Date',       width:12 },
  { key:'sl',          label:'Stop loss',      width:11 },
  { key:'sellPrice',   label:'Sell Price',     width:11 },
  { key:'sellDate',    label:'Sell Date',      width:12 },
  { key:'netBuy',      label:'Net Buy Value',  width:14 },
  { key:'netSell',     label:'Net Sell Value', width:14 },
  { key:'dma20',       label:'20DMA',          width:10 },
  { key:'dma50',       label:'50DMA',          width:10 },
  { key:'mtf',         label:'MTF Interest',   width:12 },
  { key:'netPL',       label:'Net P/L',        width:13 },
  { key:'plPct',       label:'P/L %',          width:9 },
  { key:'netBuyPrice', label:'Net Buy Price',  width:12 },
  { key:'netSellPrice',label:'Net Sell Price', width:12 },
  { key:'days',        label:'No. Of Days',    width:10 },
  { key:'slPct',       label:'Stop Loss %',    width:11 },
  { key:'grossR',      label:'Gross R',        width:9 },
  { key:'netR',        label:'Net R',          width:9 },
  { key:'mae',         label:'MEA',            width:9 },
]

// Column letter by key (A..AA)
const letter = i => i < 26 ? String.fromCharCode(65 + i) : 'A' + String.fromCharCode(65 + i - 26)
const C = Object.fromEntries(COLUMNS.map((c,i) => [c.key, letter(i)]))

const toDate = s => {
  if (!s) return null
  const [y,m,d] = String(s).slice(0,10).split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d))
}
const f = (formula, result) => ({ formula, result: result === null || result === undefined ? '' : result })

function safeSheetName(name, used) {
  let base = String(name || 'Portfolio').replace(/[\[\]:*?/\\]/g, ' ').trim().slice(0, 28) || 'Portfolio'
  let n = base, i = 2
  while (used.has(n.toLowerCase())) n = `${base.slice(0, 25)} ${i++}`
  used.add(n.toLowerCase())
  return n
}

function addPortfolioSheet(wb, portfolio, rows, summary, used) {
  const ws = wb.addWorksheet(safeSheetName(portfolio.name, used))
  ws.columns = COLUMNS.map(c => ({ width: c.width }))

  ws.getCell('A1').value = portfolio.name
  ws.getCell('A1').font = { bold:true, size:14 }
  ws.getCell('A2').value = `Accounts: ${portfolio.accountsLabel}${portfolio.size ? `   ·   Portfolio size ₹${portfolio.size.toLocaleString('en-IN')}` : ''}   ·   Open trades valued at live CMP on ${new Date().toISOString().slice(0,10)}`
  ws.getCell('A2').font = { italic:true, color:{ argb:'FF666666' } }

  const HEAD = 4
  const header = ws.getRow(HEAD)
  COLUMNS.forEach((c,i) => { header.getCell(i + 1).value = c.label })
  header.font = { bold:true, color:{ argb:'FFFFFFFF' } }
  header.alignment = { vertical:'middle', horizontal:'center', wrapText:true }
  header.eachCell(cell => { cell.fill = { type:'pattern', pattern:'solid', fgColor:{ argb:'FF1F3A5F' } } })
  header.height = 30

  const first = HEAD + 1
  rows.forEach((r, idx) => {
    const n = first + idx
    const R = k => `${C[k]}${n}`
    const v = {
      sr: idx + 1,
      month: r.month,
      account: r.account,
      status: r.status,
      symbol: r.symbol,
      setup: r.setup || null,
      riskPct: r.riskPct !== null ? r.riskPct / 100 : null,
      qty: r.qty,
      buy: r.buy,
      buyDate: toDate(r.buyDate),
      sl: r.sl,
      sellPrice: r.sellPrice !== null ? Number(r.sellPrice.toFixed(4)) : null,
      sellDate: toDate(r.sellDate),
      netBuy: f(`${R('qty')}*${R('buy')}`, r.netBuy),
      netSell: f(`IF(${R('sellPrice')}="","",${R('qty')}*${R('sellPrice')})`, r.netSell),
      dma20: r.dma20,
      dma50: r.dma50,
      mtf: Number((r.mtf || 0).toFixed(2)),
      netPL: f(`IF(${R('netSell')}="","",${R('netSell')}-${R('netBuy')}-${R('mtf')})`, r.netPL),
      plPct: f(`IF(OR(${R('netPL')}="",${R('netBuy')}=0),"",${R('netPL')}/${R('netBuy')})`, r.plPct),
      netBuyPrice: f(`IF(${R('qty')}=0,"",${R('netBuy')}/${R('qty')})`, r.netBuyPrice),
      netSellPrice: f(`IF(OR(${R('netSell')}="",${R('qty')}=0),"",${R('netSell')}/${R('qty')})`, r.netSellPrice),
      days: f(`IF(OR(${R('sellDate')}="",${R('buyDate')}=""),"",${R('sellDate')}-${R('buyDate')})`, r.days),
      slPct: f(`IF(${R('sl')}="","",1-${R('buy')}/${R('sl')})`, r.slPct),
      grossR: f(`IF(OR(${R('plPct')}="",${R('slPct')}="",${R('slPct')}=0),"",${R('plPct')}/ABS(${R('slPct')}))`, r.grossR),
      netR: f(`IF(OR(${R('grossR')}="",${R('riskPct')}=""),"",${R('grossR')}*${R('riskPct')}*100)`, r.netR),
      mae: r.mae,
    }
    const row = ws.getRow(n)
    COLUMNS.forEach((c,i) => { row.getCell(i + 1).value = v[c.key] })
    if (r.live) row.getCell(COLUMNS.findIndex(c => c.key === 'sellPrice') + 1).note = 'Live CMP (trade still open)'
  })
  const last = first + Math.max(rows.length, 1) - 1

  // Number formats for the data block
  const fmt = { riskPct:'0.00%', buy:'#,##0.00', sl:'#,##0.00', sellPrice:'#,##0.00', buyDate:'dd-mmm-yyyy', sellDate:'dd-mmm-yyyy',
    netBuy:'#,##0.00', netSell:'#,##0.00', dma20:'#,##0.00', dma50:'#,##0.00', mtf:'#,##0.00', netPL:'#,##0.00;[Red]-#,##0.00',
    plPct:'0.00%;[Red]-0.00%', netBuyPrice:'#,##0.00', netSellPrice:'#,##0.00', days:'0', slPct:'0.00%', grossR:'0.00;[Red]-0.00', netR:'0.00;[Red]-0.00' }
  COLUMNS.forEach((c,i) => { if (fmt[c.key]) ws.getColumn(i + 1).numFmt = fmt[c.key] })
  ws.views = [{ state:'frozen', ySplit: HEAD, xSplit: 5 }]
  ws.autoFilter = { from: { row: HEAD, column: 1 }, to: { row: HEAD, column: COLUMNS.length } }

  // ── Summary (formulas over the table above) ──
  const rng = k => `${C[k]}${first}:${C[k]}${last}`
  const D = rng('status'), S = rng('netPL'), T = rng('plPct'), Y = rng('grossR'), Z = rng('netR'), G = rng('riskPct')
  let r0 = last + 3
  const label = (row, text) => { const c = ws.getCell(`B${row}`); c.value = text; c.font = { bold:true } }
  const put = (row, text, formula, result, numFmt) => {
    label(row, text)
    const c = ws.getCell(`E${row}`)
    c.value = f(formula, result)
    if (numFmt) c.numFmt = numFmt
  }
  ws.getCell(`B${r0}`).value = 'SUMMARY'
  ws.getCell(`B${r0}`).font = { bold:true, size:12 }
  r0++
  const s = summary
  const winsF = `COUNTIFS(${D},"Closed",${S},">0")`, lossF = `COUNTIFS(${D},"Closed",${S},"<=0")`
  put(r0++, 'Closed trades', `${winsF}+${lossF}`, s.closedCount, '0')
  put(r0++, 'Open trades', `COUNTIFS(${D},"Open")`, s.openCount, '0')
  put(r0++, 'Win rate', `IFERROR(${winsF}/(${winsF}+${lossF}),"")`, s.winRate, '0.00%')
  const avgWinRow = r0
  put(r0++, 'Avg win %', `IFERROR(AVERAGEIFS(${T},${D},"Closed",${S},">0"),"")`, s.avgWin, '0.00%')
  const avgLossRow = r0
  put(r0++, 'Avg loss %', `IFERROR(AVERAGEIFS(${T},${D},"Closed",${S},"<=0"),"")`, s.avgLoss, '0.00%;[Red]-0.00%')
  put(r0++, 'Win / Loss ratio', `IFERROR(E${avgWinRow}/ABS(E${avgLossRow}),"")`, s.winLossRatio, '0.00')
  put(r0++, 'Total Net P/L (closed)', `SUMIFS(${S},${D},"Closed")`, s.totalPL, '#,##0.00;[Red]-#,##0.00')
  put(r0++, 'Total Net R (closed)', `SUMIFS(${Z},${D},"Closed")`, s.totalNetR ?? 0, '0.00;[Red]-0.00')
  put(r0++, 'Expectancy (avg Gross R)', `IFERROR(AVERAGEIFS(${Y},${D},"Closed"),"")`, s.expectancy, '0.00;[Red]-0.00')
  put(r0++, 'Best R', `IFERROR(MAXIFS(${Y},${D},"Closed"),"")`, s.bestR, '0.00')
  put(r0++, 'Worst R', `IFERROR(MINIFS(${Y},${D},"Closed"),"")`, s.worstR, '0.00;[Red]-0.00')
  const openRiskRow = r0
  put(r0++, 'Open risk ₹ (Buy − SL) × Qty',
    `SUMPRODUCT((${D}="Open")*ISNUMBER(${rng('sl')})*(${rng('buy')}-${rng('sl')})*${rng('qty')})`, s.openRisk, '#,##0.00')
  const capRow = r0
  label(r0, portfolio.size ? 'Portfolio size' : 'Capital (net deposits + realised P/L)')
  ws.getCell(`E${r0}`).value = Number((s.capital || 0).toFixed(2))
  ws.getCell(`E${r0}`).numFmt = '#,##0.00'
  r0++
  put(r0++, 'Open risk % of capital', `IFERROR(E${openRiskRow}/E${capRow},"")`, s.openRiskOfCapital, '0.00%')
  put(r0++, 'Open risk (sum of Risk %)', `SUMIFS(${G},${D},"Open")`, s.openRiskPct / 100, '0.00%')

  // ── Setup-wise breakdown ──
  r0 += 2
  ws.getCell(`B${r0}`).value = 'SETUP-WISE (closed trades)'
  ws.getCell(`B${r0}`).font = { bold:true, size:12 }
  r0++
  ;['Setup','Trades','Win %','Avg P/L %','Avg Gross R','Net P/L'].forEach((h,i) => {
    const c = ws.getRow(r0).getCell(2 + i); c.value = h; c.font = { bold:true }
  })
  r0++
  const F = rng('setup')
  s.bySetup.forEach(b => {
    const row = ws.getRow(r0)
    const key = `B${r0}`
    row.getCell(2).value = b.setup === '—' ? '' : b.setup
    const crit = b.setup === '—' ? `""` : key
    row.getCell(3).value = f(`COUNTIFS(${D},"Closed",${F},${crit})`, b.trades)
    row.getCell(4).value = f(`IFERROR(COUNTIFS(${D},"Closed",${F},${crit},${S},">0")/C${r0},"")`, b.winRate)
    row.getCell(4).numFmt = '0.00%'
    row.getCell(5).value = f(`IFERROR(AVERAGEIFS(${T},${D},"Closed",${F},${crit}),"")`, b.avgPL)
    row.getCell(5).numFmt = '0.00%;[Red]-0.00%'
    row.getCell(6).value = f(`IFERROR(AVERAGEIFS(${Y},${D},"Closed",${F},${crit}),"")`, b.avgR)
    row.getCell(6).numFmt = '0.00;[Red]-0.00'
    row.getCell(7).value = f(`SUMIFS(${S},${D},"Closed",${F},${crit})`, b.netPL)
    row.getCell(7).numFmt = '#,##0.00;[Red]-#,##0.00'
    r0++
  })
}

// items: [{ portfolio:{ name, accountsLabel }, rows, summary }]
export async function buildRiskWorkbook(items) {
  const mod = await import('exceljs')
  const ExcelJS = mod.default || mod
  const wb = new ExcelJS.Workbook()
  wb.creator = 'SMK Stock Journal'
  wb.calcProperties = { fullCalcOnLoad: true }
  const used = new Set()
  items.forEach(it => addPortfolioSheet(wb, it.portfolio, it.rows, it.summary, used))
  return wb
}

export async function downloadRiskWorkbook(items, filename) {
  const wb = await buildRiskWorkbook(items)
  const buf = await wb.xlsx.writeBuffer()
  const blob = new Blob([buf], { type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
