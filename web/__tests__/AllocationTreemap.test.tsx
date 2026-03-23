import { render, screen } from '@testing-library/react'
import AllocationTreemap from '../components/dashboard/AllocationTreemap'

// Mock Recharts in jsdom (SVG rendering issues)
jest.mock('recharts', () => ({
  Treemap: ({ children }: any) => <div data-testid="mock-treemap">{children}</div>,
  ResponsiveContainer: ({ children }: any) => <div>{children}</div>,
  Tooltip: () => null,
}))

const alloc = {
  snapshotDate: '2026-03-22', displayCurrency: 'TWD' as const,
  categories: [
    {
      category: 'investment' as const, label: '投資', value: 8456320, pct: 65.8,
      color: '#7c3aed', items: [{ assetId: 'a1', name: 'AAPL', value: 87320, pct: 0.68 }],
    },
  ],
}
const onSelect = jest.fn()

test('renders container', () => {
  render(<AllocationTreemap data={alloc} onCategorySelect={onSelect} />)
  expect(screen.getByTestId('allocation-treemap')).toBeInTheDocument()
})
