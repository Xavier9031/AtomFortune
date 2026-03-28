import { fireEvent, render, screen } from '@testing-library/react'
import { AssetsTable } from '@/components/assets/AssetsTable'
import type { Asset } from '@/lib/types'

const assets: Asset[] = [
  { id: '1', name: 'AAPL', assetClass: 'asset', category: 'investment',
    subKind: 'stock', symbol: 'AAPL', currencyCode: 'USD', pricingMode: 'market' },
]

it('renders asset row with all columns', () => {
  render(<AssetsTable assets={assets} onNavigate={jest.fn()} />)
  expect(screen.getAllByText('AAPL').length).toBeGreaterThan(0)
  expect(screen.getAllByText('市價').length).toBeGreaterThan(0)
})

it('calls onNavigate when asset row is clicked', () => {
  const onNavigate = jest.fn()
  render(<AssetsTable assets={assets} onNavigate={onNavigate} />)
  fireEvent.click(screen.getAllByText('AAPL')[0])
  expect(onNavigate).toHaveBeenCalledWith(assets[0])
})
