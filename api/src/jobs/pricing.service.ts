import YahooFinanceClass from 'yahoo-finance2'
const yahooFinance = new YahooFinanceClass({ suppressNotices: ['yahooSurvey'] })

type AssetInput = { id: string; symbol: string | null; pricingMode: string; subKind?: string | null; market?: string | null }

function toYahooSymbol(a: AssetInput): string {
  if (a.subKind === 'crypto') return `${a.symbol!.toUpperCase()}-USD`
  if (a.market === 'TWSE' || a.market === 'TPEX') return `${a.symbol!}.TW`
  return a.symbol!
}

export async function fetchHistoricalPricesForAssets(
  assets: AssetInput[], fromDate: string, toDate: string
): Promise<Map<string, Map<string, number>>> {
  const marketAssets = assets.filter(a => a.pricingMode === 'market' && a.symbol)
  const result = new Map<string, Map<string, number>>()
  for (const asset of marketAssets) {
    const ys = toYahooSymbol(asset)
    try {
      const history = await (yahooFinance as any).historical(ys, {
        period1: fromDate, period2: toDate, interval: '1d',
      })
      const priceMap = new Map<string, number>()
      for (const item of history) {
        const date = (item.date as Date).toISOString().slice(0, 10)
        const price = item.adjClose ?? item.close
        if (price != null) priceMap.set(date, price)
      }
      if (priceMap.size > 0) result.set(asset.id, priceMap)
    } catch (err) {
      console.warn(`[backfill] Failed history for ${ys}:`, err)
    }
  }
  return result
}

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
