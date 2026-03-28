import { render, screen } from '@testing-library/react'
import SettingsPage from '@/app/settings/page'

it('renders settings sections and dark mode toggle', () => {
  render(<SettingsPage />)
  expect(screen.getByRole('heading', { name: '設定' })).toBeInTheDocument()
  expect(screen.getByText('深色模式')).toBeInTheDocument()
  expect(screen.getAllByRole('switch').length).toBeGreaterThan(0)
})
