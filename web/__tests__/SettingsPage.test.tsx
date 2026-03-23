import { render, screen } from '@testing-library/react'
import SettingsPage from '@/app/settings/page'

it('renders currency selector and dark mode toggle', () => {
  render(<SettingsPage />)
  expect(screen.getByLabelText(/顯示幣別/)).toBeInTheDocument()
  expect(screen.getByLabelText(/深色模式/)).toBeInTheDocument()
})
