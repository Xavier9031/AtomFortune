import { render, screen } from '@testing-library/react'
import NetWorthChart from '../components/dashboard/NetWorthChart'

jest.mock('../lib/api', () => ({
  useNetWorthHistory: () => ({
    data: {
      displayCurrency: 'TWD',
      data: [
        { date: '2026-01-01', netWorth: 11200000 },
        { date: '2026-01-02', netWorth: 11350000 },
      ],
    },
  }),
  useCategoryHistory: () => ({
    data: {
      displayCurrency: 'TWD',
      data: [
        { date: '2026-01-01', investment: 7000000, liquid: 4200000 },
        { date: '2026-01-02', investment: 7100000, liquid: 4250000 },
      ],
    },
  }),
  BASE: '/api/v1',
}))

jest.mock('recharts', () => ({
  LineChart: ({ children }: any) => <div>{children}</div>,
  Line: () => null,
  XAxis: () => null,
  YAxis: () => null,
  Tooltip: () => null,
  CartesianGrid: () => null,
  ResponsiveContainer: ({ children }: any) => <div>{children}</div>,
}))

test('renders chart container', () => {
  render(<NetWorthChart currency="TWD" />)
  expect(screen.getByTestId('net-worth-chart')).toBeInTheDocument()
})
