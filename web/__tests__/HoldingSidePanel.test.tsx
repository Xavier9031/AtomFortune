import { render, screen } from '@testing-library/react'
import { HoldingSidePanel } from '@/components/holdings/HoldingSidePanel'
import type { Holding } from '@/lib/types'

// Mock SWR
jest.mock('swr', () => ({
  __esModule: true,
  default: () => ({ data: [] }),
}))

it('renders add mode with account selector as step 1', () => {
  render(<HoldingSidePanel mode="add" open={true} onClose={jest.fn()} />)
  expect(screen.getByText(/選擇帳戶/)).toBeInTheDocument()
})

it('renders edit mode with quantity input pre-filled', () => {
  const holding: Holding = {
    assetName: 'AAPL', accountName: '富途', quantity: 10,
    latestValueInBase: 87320, assetId: 'a1', accountId: 'acc1',
    assetClass: 'asset', category: 'investment', subKind: 'stock',
    currencyCode: 'USD', pricingMode: 'market', accountType: 'broker',
    updatedAt: '2026-03-22',
  }
  render(<HoldingSidePanel mode="edit" open={true} holding={holding} onClose={jest.fn()} />)
  expect(screen.getByDisplayValue('10')).toBeInTheDocument()
})
