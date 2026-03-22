import { config } from '../config'

export interface FxRateRecord {
  fromCurrency: string
  toCurrency: string
  rate: number
  source: string
}

export async function fetchFxRates(): Promise<FxRateRecord[]> {
  const results: FxRateRecord[] = []

  const exRes = await fetch(
    `https://v6.exchangerate-api.com/v6/${config.exchangerateApiKey}/latest/TWD`
  )
  if (!exRes.ok) throw new Error(`exchangerate-api error: ${exRes.status}`)
  const exData = await exRes.json()

  for (const [currency, invRate] of Object.entries(exData.rates) as [string, number][]) {
    if (currency === 'USD' || currency === 'JPY') {
      results.push({
        fromCurrency: currency,
        toCurrency: 'TWD',
        rate: 1 / invRate,
        source: 'exchangerate-api',
      })
    }
  }

  const cgRes = await fetch(
    'https://api.coingecko.com/api/v3/simple/price?ids=tether&vs_currencies=twd'
  )
  if (!cgRes.ok) throw new Error(`coingecko error: ${cgRes.status}`)
  const cgData = await cgRes.json()
  results.push({
    fromCurrency: 'USDT',
    toCurrency: 'TWD',
    rate: cgData.tether.twd,
    source: 'coingecko',
  })

  results.push({ fromCurrency: 'TWD', toCurrency: 'TWD', rate: 1.0, source: 'system' })

  return results
}
