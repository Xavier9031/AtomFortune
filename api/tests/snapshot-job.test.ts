import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { fetchMarketPrices } from '../src/jobs/pricing.service'
import { fetchFxRates } from '../src/jobs/fx.service'

vi.mock('yahoo-finance2', () => ({
  default: {
    quote: vi.fn(),
  },
}))

import yahooFinance from 'yahoo-finance2'

const ASSET_AAPL = { id: 'uuid-aapl', symbol: 'AAPL', pricingMode: 'market' as const }
const ASSET_MANUAL = { id: 'uuid-manual', symbol: null, pricingMode: 'manual' as const }
const ASSET_FIXED = { id: 'uuid-fixed', symbol: null, pricingMode: 'fixed' as const }

describe('fetchMarketPrices', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns price for a single market asset', async () => {
    vi.mocked(yahooFinance.quote).mockResolvedValueOnce([
      { symbol: 'AAPL', regularMarketPrice: 210.5 },
    ] as any)
    const result = await fetchMarketPrices([ASSET_AAPL])
    expect(result.get('uuid-aapl')).toBeCloseTo(210.5)
  })

  it('skips non-market assets — yahoo-finance2 never called', async () => {
    const result = await fetchMarketPrices([ASSET_MANUAL, ASSET_FIXED])
    expect(yahooFinance.quote).not.toHaveBeenCalled()
    expect(result.size).toBe(0)
  })

  it('skips market asset with null symbol', async () => {
    const result = await fetchMarketPrices([{ id: 'x', symbol: null, pricingMode: 'market' }])
    expect(yahooFinance.quote).not.toHaveBeenCalled()
    expect(result.size).toBe(0)
  })

  it('handles multiple tickers in one batch call', async () => {
    const ASSET_MSFT = { id: 'uuid-msft', symbol: 'MSFT', pricingMode: 'market' as const }
    vi.mocked(yahooFinance.quote).mockResolvedValueOnce([
      { symbol: 'AAPL', regularMarketPrice: 210.5 },
      { symbol: 'MSFT', regularMarketPrice: 415.0 },
    ] as any)
    const result = await fetchMarketPrices([ASSET_AAPL, ASSET_MSFT])
    expect(yahooFinance.quote).toHaveBeenCalledTimes(1)
    expect(result.get('uuid-aapl')).toBeCloseTo(210.5)
    expect(result.get('uuid-msft')).toBeCloseTo(415.0)
  })

  it('skips asset whose symbol returns null regularMarketPrice', async () => {
    vi.mocked(yahooFinance.quote).mockResolvedValueOnce([
      { symbol: 'AAPL', regularMarketPrice: null },
    ] as any)
    const result = await fetchMarketPrices([ASSET_AAPL])
    expect(result.size).toBe(0)
  })
})

describe('fetchFxRates', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })
  afterEach(() => vi.unstubAllGlobals())

  it('returns USD/JPY/USDT/TWD rates with correct sources', async () => {
    const mockFetch = vi.mocked(fetch)
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ rates: { USD: 0.030581, JPY: 4.6296 } }),
    } as Response)
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ tether: { twd: 32.68 } }),
    } as Response)

    const rates = await fetchFxRates()

    const usd = rates.find(r => r.fromCurrency === 'USD')
    const jpy = rates.find(r => r.fromCurrency === 'JPY')
    const usdt = rates.find(r => r.fromCurrency === 'USDT')
    const twd = rates.find(r => r.fromCurrency === 'TWD')

    expect(usd?.rate).toBeCloseTo(1 / 0.030581, 4)
    expect(usd?.source).toBe('exchangerate-api')
    expect(jpy?.rate).toBeCloseTo(1 / 4.6296, 4)
    expect(usdt?.rate).toBeCloseTo(32.68)
    expect(usdt?.source).toBe('coingecko')
    expect(twd?.rate).toBe(1.0)
    expect(twd?.source).toBe('system')
  })

  it('throws if exchangerate-api response is not ok', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({ ok: false, status: 500 } as Response)
    await expect(fetchFxRates()).rejects.toThrow('exchangerate-api')
  })
})
