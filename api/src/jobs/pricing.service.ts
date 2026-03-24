import yahooFinance from 'yahoo-finance2'

type AssetInput = { id: string; symbol: string | null; pricingMode: string; subKind?: string | null }

export async function fetchMarketPrices(assets: AssetInput[]): Promise<Map<string, number>> {
  const marketAssets = assets.filter(a => a.pricingMode === 'market' && a.symbol)
  const result = new Map<string, number>()
  if (marketAssets.length === 0) return result

  // Crypto symbols need '-USD' suffix for Yahoo Finance (e.g. BTC → BTC-USD)
  const yahooSymbolToId = new Map(marketAssets.map(a => {
    const ys = a.subKind === 'crypto' ? `${a.symbol!.toUpperCase()}-USD` : a.symbol!
    return [ys, a.id]
  }))
  const symbols = [...yahooSymbolToId.keys()]

  const quotes = await yahooFinance.quote(symbols) as any
  const quoteArray: any[] = Array.isArray(quotes) ? quotes : [quotes]

  for (const q of quoteArray) {
    if (q.regularMarketPrice != null) {
      const assetId = yahooSymbolToId.get(q.symbol)
      if (assetId) result.set(assetId, q.regularMarketPrice)
    }
  }
  return result
}
