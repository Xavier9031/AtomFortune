'use client'
import { useState, useMemo } from 'react'
import useSWR from 'swr'
import { BASE, fetcher } from '@/lib/api'
import { AccountsTable } from '@/components/accounts/AccountsTable'
import { AccountSidePanel } from '@/components/accounts/AccountSidePanel'
import type { Account, Holding } from '@/lib/types'

export default function AccountsPage() {
  const { data: accounts, mutate } = useSWR<Account[]>(`${BASE}/accounts`, fetcher)
  const { data: holdings } = useSWR<Holding[]>(`${BASE}/holdings`, fetcher)
  const [panelOpen, setPanelOpen] = useState(false)
  const [editAccount, setEditAccount] = useState<Account | undefined>()

  const holdingsCount = useMemo(() => {
    const m: Record<string, number> = {}
    for (const h of holdings ?? []) m[h.accountId] = (m[h.accountId] ?? 0) + 1
    return m
  }, [holdings])

  function openEdit(a: Account) { setEditAccount(a); setPanelOpen(true) }
  function openAdd() { setEditAccount(undefined); setPanelOpen(true) }

  return (
    <main className="p-6 max-w-5xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-xl font-bold">帳戶管理</h1>
        <button onClick={openAdd}
          className="bg-[var(--color-accent)] text-white px-4 py-2 rounded">+ 新增帳戶</button>
      </div>
      <AccountsTable
        accounts={accounts ?? []}
        holdingsCount={holdingsCount}
        onEdit={openEdit}
      />
      <AccountSidePanel
        open={panelOpen}
        account={editAccount}
        holdingsCount={editAccount ? (holdingsCount[editAccount.id] ?? 0) : 0}
        onClose={() => { setPanelOpen(false); setEditAccount(undefined); mutate() }}
      />
    </main>
  )
}
