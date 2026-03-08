// In-memory cache of NSE instruments — loaded once per server instance
let instrumentCache = null
let cacheTime = 0
const CACHE_TTL = 6 * 60 * 60 * 1000 // 6 hours

async function loadInstruments() {
  const now = Date.now()
  if (instrumentCache && (now - cacheTime) < CACHE_TTL) return instrumentCache

  try {
    // NSE equity master — symbol, name, series, ISIN
    const r = await fetch('https://archives.nseindia.com/content/equities/EQUITY_L.csv', {
      headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'text/csv' }
    })
    const text = await r.text()
    const lines = text.trim().split('\n').slice(1) // skip header

    instrumentCache = lines.map(line => {
      const cols = line.split(',')
      const symbol = (cols[0] || '').trim().replace(/"/g, '')
      const name = (cols[1] || '').trim().replace(/"/g, '')
      return { symbol, name, yahooSymbol: `${symbol}.NS`, exchange: 'NSE' }
    }).filter(i => i.symbol && i.name)

    cacheTime = now
    return instrumentCache
  } catch {
    return []
  }
}

export default async function handler(req, res) {
  const { q } = req.query
  if (!q || q.length < 1) return res.status(200).json([])

  const query = q.toUpperCase().trim()
  const instruments = await loadInstruments()

  if (instruments.length === 0) {
    // Fallback to Yahoo if NSE master fails
    return yahooFallback(query, res)
  }

  // Search: ticker starts with query first, then name contains query
  const startsWithTicker = instruments.filter(i => i.symbol.startsWith(query))
  const nameContains = instruments.filter(i =>
    !i.symbol.startsWith(query) && i.name.toUpperCase().includes(query)
  )

  const results = [...startsWithTicker, ...nameContains]
    .slice(0, 10)
    .map(i => ({
      ticker: i.symbol,
      yahooSymbol: i.yahooSymbol,
      shortName: i.name,
      exchange: 'NSE',
    }))

  return res.status(200).json(results)
}

async function yahooFallback(query, res) {
  try {
    const url = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(query)}&lang=en-US&region=IN&quotesCount=15&newsCount=0`
    const r = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
        'Referer': 'https://finance.yahoo.com',
      }
    })
    const data = await r.json()
    const quotes = (data?.quotes || [])
      .filter(i => i.symbol?.endsWith('.NS') || i.symbol?.endsWith('.BO') || ['NSI','NSE','BSE','BOM'].includes(i.exchange))
      .reduce((acc, item) => {
        const base = item.symbol.replace('.NS','').replace('.BO','')
        if (!acc[base] || item.symbol.endsWith('.NS')) acc[base] = item
        return acc
      }, {})

    const results = Object.values(quotes).slice(0, 8).map(item => ({
      ticker: item.symbol.replace('.NS','').replace('.BO',''),
      yahooSymbol: item.symbol,
      shortName: item.shortname || item.longname || item.symbol,
      exchange: item.symbol.endsWith('.NS') ? 'NSE' : 'BSE',
    }))
    return res.status(200).json(results)
  } catch {
    return res.status(200).json([])
  }
}
