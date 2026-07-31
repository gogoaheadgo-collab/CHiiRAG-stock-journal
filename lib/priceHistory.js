export async function fetchDailyBars(ticker, fromDate, toDate) {
  const unixFrom = Math.floor(new Date(fromDate).getTime() / 1000)
  const unixTo = Math.floor(new Date(toDate).getTime() / 1000)

  const tickers = ticker.includes('.') ? [ticker] : [`${ticker}.NS`, `${ticker}.BO`]
  const sources = [fetchYahooQ1Bars, fetchYahooQ2Bars]

  for (const t of tickers) {
    for (const source of sources) {
      try {
        const bars = await source(t, unixFrom, unixTo)
        if (bars) return bars
      } catch {}
    }
  }

  throw new Error(`Unable to fetch price history for ${ticker}`)
}

function parseBars(data) {
  const result = data?.chart?.result?.[0]
  if (!result) return null
  const timestamps = result.timestamp
  const quote = result.indicators?.quote?.[0]
  if (!timestamps || !quote) return null

  const bars = []
  for (let i = 0; i < timestamps.length; i++) {
    const high = quote.high[i]
    const low = quote.low[i]
    if (high == null || low == null) continue
    bars.push({
      date: new Date(timestamps[i] * 1000).toISOString().slice(0, 10),
      open: quote.open[i],
      high,
      low,
      close: quote.close[i],
      volume: quote.volume[i],
    })
  }
  return bars
}

async function fetchYahooQ1Bars(ticker, unixFrom, unixTo) {
  const r = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?period1=${unixFrom}&period2=${unixTo}&interval=1d`, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'application/json',
      'Referer': 'https://finance.yahoo.com',
      'Origin': 'https://finance.yahoo.com',
    }
  })
  const data = await r.json()
  const bars = parseBars(data)
  if (!bars) throw new Error('No data')
  return bars
}

async function fetchYahooQ2Bars(ticker, unixFrom, unixTo) {
  const r = await fetch(`https://query2.finance.yahoo.com/v8/finance/chart/${ticker}?period1=${unixFrom}&period2=${unixTo}&interval=1d`, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Safari/605.1.15',
      'Accept': '*/*',
      'Referer': 'https://finance.yahoo.com',
    }
  })
  const data = await r.json()
  const bars = parseBars(data)
  if (!bars) throw new Error('No data')
  return bars
}
