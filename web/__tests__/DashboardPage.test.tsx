import { render, screen } from '@testing-library/react'
import DashboardPage from '../app/page'

jest.mock('../lib/api', () => ({
  useLiveDashboard: () => ({ data: null, isLoading: true }),
}))
jest.mock('../context/CurrencyContext', () => ({
  useCurrency: () => ({ currency: 'TWD', setCurrency: jest.fn() }),
  CurrencyProvider: ({ children }: any) => children,
}))

test('dashboard renders loading skeleton', () => {
  render(<DashboardPage />)
  expect(screen.getByTestId('dashboard-loading')).toBeInTheDocument()
})
