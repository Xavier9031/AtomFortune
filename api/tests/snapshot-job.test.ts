import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { fetchMarketPrices } from '../src/jobs/pricing.service'

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
