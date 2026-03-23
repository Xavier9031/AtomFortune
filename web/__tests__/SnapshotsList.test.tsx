import { render, screen, fireEvent } from '@testing-library/react'
import { SnapshotsList } from '@/components/snapshots/SnapshotsList'

// Mock fetch for snapshot detail requests
global.fetch = jest.fn(() =>
  Promise.resolve({ ok: true, json: () => Promise.resolve({ items: [] }) } as Response)
)

const dates = ['2026-03-22', '2026-03-21']

it('renders snapshot dates', () => {
  render(<SnapshotsList dates={dates} onRebuild={jest.fn()} onExpand={jest.fn()} />)
  expect(screen.getByText('2026-03-22')).toBeInTheDocument()
  expect(screen.getByText('2026-03-21')).toBeInTheDocument()
})

it('calls onExpand with date when row is clicked', () => {
  const onExpand = jest.fn()
  render(<SnapshotsList dates={dates} onRebuild={jest.fn()} onExpand={onExpand} />)
  fireEvent.click(screen.getByText('2026-03-22'))
  expect(onExpand).toHaveBeenCalledWith('2026-03-22')
})
