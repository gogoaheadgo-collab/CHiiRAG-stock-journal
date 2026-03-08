export default async function handler(req, res) {
  const { q } = req.query
  if (!q || q.length < 1) return res.status(200).json([])

  try {
    const url = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(q)}&quotesCount=10&newsCount=0&listsCount=0`
    const r = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json',
        'Referer': 'https://finance.yahoo.com',
      }
    })

    const data = await r.json()
    const quotes = data?.quotes || []

    const results = quotes
      .filter(item => item.exchange === 'NSI' || item.exchange === 'BSE' || (item.quoteType === 'EQUITY' && (item.symbol?.endsWith('.NS') || item.symbol?.endsWith('.BO'))))
      .map(item => ({
        ticker: item.symbol?.replace('.NS', '').replace('.BO', '') || item.symbol,
        fullTicker: item.symbol,
        shortName: item.shortname || item.longname || item.symbol,
        exchange: item.exchange === 'NSI' ? 'NSE' : item.exchange === 'BSE' ? 'BSE' : item.exchange,
      }))
      .slice(0, 8)

    return res.status(200).json(results)
  } catch (e) {
    return res.status(200).json([])
  }
}
