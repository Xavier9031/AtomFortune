import yahooFinance from 'yahoo-finance2'

type AssetInput = { id: string; symbol: string | null; pricingMode: string }

export async function fetchMarketPrices(assets: AssetInput[]): Promise<Map<string, number>> {
  const marketAssets = assets.filter(a => a.pricingMode === 'market' && a.symbol)
  const result = new Map<string, number>()
  if (marketAssets.length === 0) return result

  const symbolToId = new Map(marketAssets.map(a => [a.symbol!, a.id]))
  const symbols = [...symbolToId.keys()]

  const quotes = await yahooFinance.quote(symbols)
  const quoteArray = Array.isArray(quotes) ? quotes : [quotes]

  for (const q of quoteArray) {
    if (q.regularMarketPrice != null) {
      const assetId = symbolToId.get(q.symbol)
      if (assetId) result.set(assetId, q.regularMarketPrice)
    }
  }
  return result
}
