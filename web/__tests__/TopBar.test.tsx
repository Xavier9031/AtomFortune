import { render, screen, fireEvent } from '@testing-library/react'
import { CurrencyProvider } from '../context/CurrencyContext'
import TopBar from '../components/layout/TopBar'

const wrap = (ui: React.ReactElement) => render(<CurrencyProvider>{ui}</CurrencyProvider>)

test('renders currency selector with TWD default', () => {
  wrap(<TopBar />)
  expect(screen.getByRole('combobox')).toHaveValue('TWD')
})
test('currency change updates context', () => {
  wrap(<TopBar />)
  fireEvent.change(screen.getByRole('combobox'), { target: { value: 'USD' } })
  expect(screen.getByRole('combobox')).toHaveValue('USD')
})
test('theme toggle button is present', () => {
  wrap(<TopBar />)
  expect(screen.getByRole('button', { name: /theme/i })).toBeInTheDocument()
})
