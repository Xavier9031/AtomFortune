import { render, screen } from '@testing-library/react'
import NetWorthHeader from '../components/dashboard/NetWorthHeader'

const summary = {
  snapshotDate: '2026-03-22', displayCurrency: 'TWD' as const,
  netWorth: 12847320, totalAssets: 13199320, totalLiabilities: 352000,
  changeAmount: 289000, changePct: 2.30, missingAssets: [],
}

test('renders net worth value', () => {
  render(<NetWorthHeader summary={summary} />)
  expect(screen.getByTestId('net-worth-value')).toHaveTextContent('12,847,320')
})
test('renders positive change badge with green color class', () => {
  render(<NetWorthHeader summary={summary} />)
  expect(screen.getByTestId('change-badge')).toHaveTextContent('+2.30%')
})
test('renders data-as-of date', () => {
  render(<NetWorthHeader summary={summary} />)
  expect(screen.getByText(/2026-03-22/)).toBeInTheDocument()
})
