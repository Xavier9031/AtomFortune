import { render, screen } from '@testing-library/react'
import { AccountsTable } from '@/components/accounts/AccountsTable'
import type { Account } from '@/lib/types'

const accounts: Account[] = [
  { id: '1', name: '富途', institution: 'Futu', accountType: 'broker', note: '' },
]

it('renders account row', () => {
  render(<AccountsTable accounts={accounts} holdingsCount={{ '1': 3 }} onEdit={jest.fn()} />)
  expect(screen.getByText('富途')).toBeInTheDocument()
  expect(screen.getByText('3')).toBeInTheDocument()
})

it('disables delete button when account has holdings', () => {
  render(<AccountsTable accounts={accounts} holdingsCount={{ '1': 2 }} onEdit={jest.fn()} />)
  expect(screen.getByRole('button', { name: /刪除/ })).toBeDisabled()
})
