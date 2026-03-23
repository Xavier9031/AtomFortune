import { render, screen } from '@testing-library/react'
import { AssetsTable } from '@/components/assets/AssetsTable'
import type { Asset } from '@/lib/types'

const assets: Asset[] = [
  { id: '1', name: 'AAPL', assetClass: 'asset', category: 'investment',
    subKind: 'stock', symbol: 'AAPL', currencyCode: 'USD', pricingMode: 'market' },
]

it('renders asset row with all columns', () => {
  render(<AssetsTable assets={assets} onNavigate={jest.fn()} />)
  expect(screen.getAllByText('AAPL').length).toBeGreaterThan(0)
  expect(screen.getByText('market')).toBeInTheDocument()
})

it('navigates to /assets/[id] on row click', () => {
  render(<AssetsTable assets={assets} onNavigate={jest.fn()} />)
  expect(screen.getByRole('link', { name: /AAPL/i })).toHaveAttribute('href', '/assets/1')
})
