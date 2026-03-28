import { render, screen } from '@testing-library/react'
import { HoldingsList } from '@/components/holdings/HoldingsList'
import type { Holding } from '@/lib/types'

const mockHoldings: Holding[] = [
  {
    assetId: 'a1', accountId: 'acc1', quantity: 10, assetName: 'AAPL',
    accountName: '富途', latestValueInBase: 87320,
    assetClass: 'asset', category: 'investment', subKind: 'stock',
    currencyCode: 'USD', pricingMode: 'market', accountType: 'broker',
    updatedAt: '2026-03-22',
  },
  {
    assetId: 'a2', accountId: 'acc2', quantity: 5, assetName: 'BTC',
    accountName: '幣安', latestValueInBase: null,
    assetClass: 'asset', category: 'investment', subKind: 'crypto',
    currencyCode: 'USD', pricingMode: 'market', accountType: 'crypto_exchange',
    updatedAt: '2026-03-22',
  },
]

it('groups holdings by account name as section headers', () => {
  render(<HoldingsList holdings={mockHoldings} onRowClick={jest.fn()} />)
  expect(screen.getAllByText('富途').length).toBeGreaterThan(0)
  expect(screen.getAllByText('幣安').length).toBeGreaterThan(0)
  expect(screen.getAllByText('AAPL').length).toBeGreaterThan(0)
})
