import { render, screen } from '@testing-library/react'
import NetWorthChart from '../components/dashboard/NetWorthChart'

jest.mock('recharts', () => ({
  LineChart: ({ children }: any) => <div>{children}</div>,
  Line: () => null,
  XAxis: () => null,
  YAxis: () => null,
  Tooltip: () => null,
  CartesianGrid: () => null,
  ResponsiveContainer: ({ children }: any) => <div>{children}</div>,
}))

const history = {
  displayCurrency: 'TWD' as const,
  data: [
    { date: '2026-01-01', netWorth: 11200000 },
    { date: '2026-01-02', netWorth: 11350000 },
  ],
}

test('renders chart container', () => {
  render(<NetWorthChart data={history} />)
  expect(screen.getByTestId('net-worth-chart')).toBeInTheDocument()
})
