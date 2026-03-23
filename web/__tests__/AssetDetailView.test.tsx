import { render, screen } from '@testing-library/react'
import { AssetDetailView } from '@/components/assets/AssetDetailView'
import type { Asset } from '@/lib/types'

// Mock SWR
jest.mock('swr', () => ({
  __esModule: true,
  default: () => ({ data: undefined }),
}))

it('shows manual price button only for manual pricingMode', () => {
  const asset = { id: '1', name: 'My Fund', pricingMode: 'manual',
    assetClass: 'asset', category: 'investment', subKind: 'fund',
    currencyCode: 'TWD' } as Asset
  render(<AssetDetailView asset={asset} />)
  expect(screen.getByText('更新今日價格')).toBeInTheDocument()
})

it('hides manual price button for market assets', () => {
  const asset = { id: '1', name: 'AAPL', pricingMode: 'market',
    assetClass: 'asset', category: 'investment', subKind: 'stock',
    currencyCode: 'USD' } as Asset
  render(<AssetDetailView asset={asset} />)
  expect(screen.queryByText('更新今日價格')).not.toBeInTheDocument()
})
