'use client'
import { useState, useMemo } from 'react'
import useSWR from 'swr'
import { BASE, fetcher } from '@/lib/api'
import { AccountsTable } from '@/components/accounts/AccountsTable'
import { AccountFormModal } from '@/components/accounts/AccountFormModal'
import type { Account, Holding } from '@/lib/types'

export default function AccountsPage() {
  const { data: accounts, mutate } = useSWR<Account[]>(`${BASE}/accounts`, fetcher)
  const { data: holdings } = useSWR<Holding[]>(`${BASE}/holdings`, fetcher)
  const [modalOpen, setModalOpen] = useState(false)
  const [editAccount, setEditAccount] = useState<Account | undefined>()

  const holdingsCount = useMemo(() => {
    const m: Record<string, number> = {}
    for (const h of holdings ?? []) m[h.accountId] = (m[h.accountId] ?? 0) + 1
    return m
  }, [holdings])

  async function handleDelete(id: string) {
    if (!confirm('確認刪除帳戶？')) return
    const res = await fetch(`${BASE}/accounts/${id}`, { method: 'DELETE' })
    if (!res.ok) alert('刪除失敗')
    else mutate()
  }

  function handleEdit(a: Account) {
    setEditAccount(a); setModalOpen(true)
  }

  return (
    <main className="p-6 max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-xl font-bold">帳戶管理</h1>
        <button onClick={() => { setEditAccount(undefined); setModalOpen(true) }}
          className="bg-[var(--color-accent)] text-white px-4 py-2 rounded">+ 新增帳戶</button>
      </div>
      <AccountsTable
        accounts={accounts ?? []}
        holdingsCount={holdingsCount}
        onEdit={handleEdit}
        onDelete={handleDelete}
      />
      <AccountFormModal
        open={modalOpen}
        account={editAccount}
        onClose={() => { setModalOpen(false); setEditAccount(undefined); mutate() }}
      />
    </main>
  )
}
