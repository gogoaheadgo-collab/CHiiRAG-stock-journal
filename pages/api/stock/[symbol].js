export default async function handler(req, res) {
  const { symbol } = req.query
  if (!symbol) return res.status(400).json({ error: 'Symbol required' })

  const ticker = symbol.includes('.') ? symbol : `${symbol}.NS`
  const sources = [fetchYahooQ1, fetchYahooQ2, fetchYahooV7]

  for (const source of sources) {
    try {
      const data = await source(ticker)
      if (data?.price) return res.status(200).json(data)
    } catch {}
  }

  return res.status(200).json({ error: 'Price unavailable', price: null })
}

async function fetchYahooQ1(ticker) {
  const r = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=1d`, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'application/json', 'Referer': 'https://finance.yahoo.com', 'Origin': 'https://finance.yahoo.com',
    }
  })
  const data = await r.json()
  const meta = data?.chart?.result?.[0]?.meta
  if (!meta?.regularMarketPrice) throw new Error('No data')
  const prev = meta.chartPreviousClose || meta.previousClose || meta.regularMarketPrice
  return { symbol: meta.symbol, price: meta.regularMarketPrice, previousClose: prev, change: meta.regularMarketPrice - prev, changePercent: ((meta.regularMarketPrice - prev) / prev) * 100, marketState: meta.marketState }
}

async function fetchYahooQ2(ticker) {
  const r = await fetch(`https://query2.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=1d`, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Safari/605.1.15',
      'Accept': '*/*', 'Referer': 'https://finance.yahoo.com',
    }
  })
  const data = await r.json()
  const meta = data?.chart?.result?.[0]?.meta
  if (!meta?.regularMarketPrice) throw new Error('No data')
  const prev = meta.chartPreviousClose || meta.regularMarketPrice
  return { symbol: meta.symbol, price: meta.regularMarketPrice, previousClose: prev, change: meta.regularMarketPrice - prev, changePercent: ((meta.regularMarketPrice - prev) / prev) * 100, marketState: meta.marketState }
}

async function fetchYahooV7(ticker) {
  const r = await fetch(`https://query1.finance.yahoo.com/v7/finance/quote?symbols=${ticker}`, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'application/json', 'Referer': 'https://finance.yahoo.com',
    }
  })
  const data = await r.json()
  const q = data?.quoteResponse?.result?.[0]
  if (!q?.regularMarketPrice) throw new Error('No data')
  return { symbol: q.symbol, price: q.regularMarketPrice, previousClose: q.regularMarketPreviousClose, change: q.regularMarketChange, changePercent: q.regularMarketChangePercent, marketState: q.marketState }
}
