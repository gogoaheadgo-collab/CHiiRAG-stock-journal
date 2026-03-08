export default async function handler(req, res) {
  const { q } = req.query
  if (!q || q.length < 1) return res.status(200).json([])

  try {
    const url = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(q)}&lang=en-US&region=IN&quotesCount=15&newsCount=0&enableFuzzyQuery=true`
    const r = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json',
        'Referer': 'https://finance.yahoo.com',
      }
    })
    const data = await r.json()
    const quotes = data?.quotes || []

    // Be permissive - include anything ending in .NS or .BO, plus known exchange codes
    const NSE_CODES = ['NSI', 'NSE']
    const BSE_CODES = ['BSE', 'BOM']

    const results = quotes
      .filter(item => {
        const sym = item.symbol || ''
        const exch = item.exchange || ''
        return (
          sym.endsWith('.NS') ||
          sym.endsWith('.BO') ||
          NSE_CODES.includes(exch) ||
          BSE_CODES.includes(exch)
        )
      })
      // Prefer .NS over .BO — deduplicate by base ticker
      .reduce((acc, item) => {
        const base = (item.symbol || '').replace('.NS','').replace('.BO','')
        const isNSE = item.symbol?.endsWith('.NS') || NSE_CODES.includes(item.exchange)
        if (!acc.map[base] || isNSE) {
          acc.map[base] = item
        }
        return acc
      }, { map: {} })

    const deduped = Object.values(results.map)

    const formatted = deduped.map(item => ({
      ticker: (item.symbol || '').replace('.NS','').replace('.BO',''),
      yahooSymbol: item.symbol,
      shortName: item.shortname || item.longname || item.symbol || '',
      exchange: item.symbol?.endsWith('.NS') || NSE_CODES.includes(item.exchange) ? 'NSE' : 'BSE',
    })).slice(0, 8)

    return res.status(200).json(formatted)
  } catch {
    return res.status(200).json([])
  }
}
