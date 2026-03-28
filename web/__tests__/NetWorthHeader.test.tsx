import { render, screen } from '@testing-library/react'
import NetWorthHeader from '../components/dashboard/NetWorthHeader'

jest.mock('../lib/api', () => ({
  useNetWorthHistory: () => ({
    data: {
      displayCurrency: 'TWD',
      data: [
        { date: '2026-02-20', netWorth: 12000000 },
        { date: '2026-03-22', netWorth: 12847320 },
      ],
    },
  }),
}))

const summary = {
  snapshotDate: '2026-03-22', displayCurrency: 'TWD' as const,
  netWorth: 12847320, totalAssets: 13199320, totalLiabilities: 352000,
  changeAmount: 289000, changePct: 2.30, prevSnapshotDate: '2026-03-21', missingAssets: [],
}

test('renders net worth value', () => {
  render(<NetWorthHeader summary={summary} currency="TWD" />)
  expect(screen.getByTestId('net-worth-value')).toHaveTextContent('12,847,320')
})
test('renders positive change badge with green color class', () => {
  render(<NetWorthHeader summary={summary} currency="TWD" />)
  expect(screen.getByText('+NT$847,320')).toBeInTheDocument()
  expect(screen.getByText(/7\.1%/)).toBeInTheDocument()
})
test('renders data-as-of date', () => {
  render(<NetWorthHeader summary={summary} currency="TWD" />)
  expect(screen.getByText(/2026-03-22/)).toBeInTheDocument()
})
