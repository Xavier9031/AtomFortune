import { describe, it, expect } from 'vitest'
import { assets, accounts, holdings, transactions, prices, fxRates, snapshotItems } from '../src/db/schema'

describe('Drizzle schema', () => {
  it('exports all 7 tables', () => {
    expect(assets).toBeDefined()
    expect(accounts).toBeDefined()
    expect(holdings).toBeDefined()
    expect(transactions).toBeDefined()
    expect(prices).toBeDefined()
    expect(fxRates).toBeDefined()
    expect(snapshotItems).toBeDefined()
  })
  it('assets table has required columns', () => {
    const cols = Object.keys(assets)
    expect(cols).toContain('id')
    expect(cols).toContain('assetClass')
    expect(cols).toContain('pricingMode')
  })
})
