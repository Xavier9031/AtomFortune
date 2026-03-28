import YahooFinanceClass from 'yahoo-finance2'
import { SUPPORTED_CURRENCIES } from '../currencies'

const yahooFinance = new YahooFinanceClass({ suppressNotices: ['yahooSurvey'] })

export interface FxRateRecord {
  fromCurrency: string
  toCurrency: string
  rate: number
  source: string
}

function toYahooFxSymbol(currency: string): string {
  return `${currency}TWD=X`
}

export async function fetchFxRates(): Promise<FxRateRecord[]> {
  const results: FxRateRecord[] = []
  const currencies = SUPPORTED_CURRENCIES.filter(c => c !== 'TWD')
  const symbols = currencies.map(toYahooFxSymbol)

  const quotes = await yahooFinance.quote(symbols) as any
  const quoteArray: any[] = Array.isArray(quotes) ? quotes : [quotes]

  for (const q of quoteArray) {
    if (q.regularMarketPrice != null) {
      const match = q.symbol?.match(/^(\w+)TWD=X$/)
      if (match) {
        results.push({
          fromCurrency: match[1],
          toCurrency: 'TWD',
          rate: q.regularMarketPrice,
          source: 'yahoo-finance2',
        })
      }
    }
  }

  // USDT ≈ USD
  const usdRate = results.find(r => r.fromCurrency === 'USD')
  if (usdRate) {
    results.push({
      fromCurrency: 'USDT',
      toCurrency: 'TWD',
      rate: usdRate.rate,
      source: 'yahoo-finance2',
    })
  }

  results.push({ fromCurrency: 'TWD', toCurrency: 'TWD', rate: 1.0, source: 'system' })
  return results
}

/** Fetch historical FX rates from Yahoo Finance. Returns currency → (date → rate). */
export async function fetchHistoricalFxRates(
  fromDate: string, toDate: string
): Promise<Map<string, Map<string, number>>> {
  const currencies = SUPPORTED_CURRENCIES.filter(c => c !== 'TWD')
  const result = new Map<string, Map<string, number>>()

  for (const currency of currencies) {
    const symbol = toYahooFxSymbol(currency)
    try {
      const history = await (yahooFinance as any).historical(symbol, {
        period1: fromDate, period2: toDate, interval: '1d',
      })
      const rateMap = new Map<string, number>()
      for (const item of history) {
        const date = (item.date as Date).toISOString().slice(0, 10)
        const rate = item.adjClose ?? item.close
        if (rate != null) rateMap.set(date, rate)
      }
      if (rateMap.size > 0) result.set(currency, rateMap)
    } catch (err) {
      console.warn(`[fx-backfill] Failed history for ${symbol}:`, err)
    }
  }

  // USDT: copy USD rates
  const usdRates = result.get('USD')
  if (usdRates) result.set('USDT', new Map(usdRates))

  return result
}
