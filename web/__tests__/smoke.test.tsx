import { render, screen } from '@testing-library/react'
import Page from '../app/page'

// Smoke test: dashboard page renders without crashing
jest.mock('../lib/api', () => ({
  useDashboardSummary: () => ({ data: null, isLoading: true }),
  useAllocation: () => ({ data: null, isLoading: true }),
  useNetWorthHistory: () => ({ data: null, isLoading: true }),
}))
jest.mock('../context/CurrencyContext', () => ({
  useCurrency: () => ({ currency: 'TWD', setCurrency: jest.fn() }),
  CurrencyProvider: ({ children }: any) => children,
}))

test('dashboard page renders loading state', () => {
  render(<Page />)
  expect(screen.getByTestId('dashboard-root')).toBeInTheDocument()
})
