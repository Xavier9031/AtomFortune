import YahooFinanceClass from 'yahoo-finance2'
const yahooFinance = new YahooFinanceClass({ suppressNotices: ['yahooSurvey'] })

type AssetInput = { id: string; symbol: string | null; pricingMode: string; subKind?: string | null; market?: string | null }

export async function fetchMarketPrices(assets: AssetInput[]): Promise<Map<string, number>> {
  const marketAssets = assets.filter(a => a.pricingMode === 'market' && a.symbol)
  const result = new Map<string, number>()
  if (marketAssets.length === 0) return result

  // Adjust symbols for Yahoo Finance:
  // - Crypto: append '-USD' (e.g. BTC → BTC-USD)
  // - Taiwan stocks/ETFs: append '.TW' (e.g. 00878 → 00878.TW)
  const yahooSymbolToId = new Map(marketAssets.map(a => {
    let ys: string
    if (a.subKind === 'crypto') {
      ys = `${a.symbol!.toUpperCase()}-USD`
    } else if (a.market === 'TWSE' || a.market === 'TPEX') {
      ys = `${a.symbol!}.TW`
    } else {
      ys = a.symbol!
    }
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
