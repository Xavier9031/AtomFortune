import { render, screen } from '@testing-library/react'
import HoldingsAccordion from '../components/dashboard/HoldingsAccordion'

// Mock Next.js Link - use esModuleInterop format
jest.mock('next/link', () => {
  const MockLink = ({ href, children }: any) => <a href={href}>{children}</a>
  MockLink.displayName = 'MockLink'
  return { __esModule: true, default: MockLink }
})

const alloc = {
  snapshotDate: '2026-03-22', displayCurrency: 'TWD' as const,
  categories: [
    {
      category: 'investment' as const, label: '投資', value: 8456320, pct: 65.8, color: '#7c3aed',
      items: [{ assetId: 'a1', name: 'AAPL', value: 87320, pct: 0.68 }],
    },
  ],
}

test('renders category header', () => {
  render(<HoldingsAccordion data={alloc} expandedCategory={null} />)
  expect(screen.getByText('投資')).toBeInTheDocument()
})
test('shows items when expandedCategory matches', () => {
  render(<HoldingsAccordion data={alloc} expandedCategory="investment" />)
  expect(screen.getByText('AAPL')).toBeInTheDocument()
})
test('hides items when expandedCategory is null', () => {
  render(<HoldingsAccordion data={alloc} expandedCategory={null} />)
  expect(screen.queryByText('AAPL')).not.toBeInTheDocument()
})
