export default async function handler(req, res) {
  const { q } = req.query
  if (!q || q.length < 1) return res.status(200).json([])

  try {
    const url = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(q)}&quotesCount=10&newsCount=0&enableFuzzyQuery=false&quotesQueryId=tss_match_phrase_query&multiQuoteQueryId=multi_quote_single_token_query&enableCb=true&enableNavLinks=false&enableEnhancedTrivialQuery=true`
    const r = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json',
        'Referer': 'https://finance.yahoo.com',
      }
    })
    const data = await r.json()
    const quotes = (data?.quotes || [])
      .filter(q => q.exchDisp === 'NSE' || q.exchDisp === 'BSE' || q.exchange === 'NSI' || q.exchange === 'BSE')
      .slice(0, 8)
      .map(q => ({
        symbol: q.symbol?.replace('.NS','').replace('.BO',''),
        yahooSymbol: q.symbol,
        name: q.longname || q.shortname || q.symbol,
        exchange: q.exchDisp || q.exchange,
      }))
    return res.status(200).json(quotes)
  } catch (e) {
    return res.status(200).json([])
  }
}
