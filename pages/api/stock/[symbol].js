export default async function handler(req, res) {
  const { symbol } = req.query
  if (!symbol) return res.status(400).json({ error: 'Symbol required' })

  try {
    const ticker = symbol.includes('.') ? symbol : `${symbol}.NS`
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=1d`
    const r = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' },
    })
    const data = await r.json()
    const meta = data?.chart?.result?.[0]?.meta
    if (!meta) throw new Error('No data')

    res.status(200).json({
      symbol: meta.symbol,
      price: meta.regularMarketPrice,
      previousClose: meta.chartPreviousClose,
      change: meta.regularMarketPrice - meta.chartPreviousClose,
      changePercent: ((meta.regularMarketPrice - meta.chartPreviousClose) / meta.chartPreviousClose) * 100,
      marketState: meta.marketState,
    })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
}
