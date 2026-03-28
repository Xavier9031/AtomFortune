import { render, screen, fireEvent } from '@testing-library/react'
import { CurrencyProvider } from '../context/CurrencyContext'
import TopBar from '../components/layout/TopBar'

jest.mock('../components/layout/UserSwitcher', () => ({
  __esModule: true,
  default: () => <div data-testid="user-switcher" />,
}))

const wrap = (ui: React.ReactElement) => render(<CurrencyProvider>{ui}</CurrencyProvider>)

test('renders currency selector with TWD default', () => {
  wrap(<TopBar />)
  expect(screen.getByRole('button', { name: /TWD/ })).toBeInTheDocument()
})

test('currency change updates context', () => {
  wrap(<TopBar />)
  fireEvent.click(screen.getByRole('button', { name: /TWD/ }))
  fireEvent.click(screen.getByRole('button', { name: /USD/ }))
  expect(screen.getByRole('button', { name: /USD/ })).toBeInTheDocument()
})

test('theme toggle button is present', () => {
  wrap(<TopBar />)
  expect(screen.getByRole('button', { name: /theme/i })).toBeInTheDocument()
})
