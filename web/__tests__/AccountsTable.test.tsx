import { fireEvent, render, screen } from '@testing-library/react'
import { AccountsTable } from '@/components/accounts/AccountsTable'
import type { Account } from '@/lib/types'

const accounts: Account[] = [
  { id: '1', name: '富途', institution: 'Futu', accountType: 'broker', note: '' },
]

it('renders account row', () => {
  render(<AccountsTable accounts={accounts} holdingsCount={{ '1': 3 }} onEdit={jest.fn()} />)
  expect(screen.getAllByText('富途').length).toBeGreaterThan(0)
  expect(screen.getByText('3')).toBeInTheDocument()
})

it('calls onEdit when account row is clicked', () => {
  const onEdit = jest.fn()
  render(<AccountsTable accounts={accounts} holdingsCount={{ '1': 2 }} onEdit={onEdit} />)
  fireEvent.click(screen.getAllByText('富途')[0])
  expect(onEdit).toHaveBeenCalledWith(accounts[0])
})
