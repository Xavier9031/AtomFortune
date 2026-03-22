'use client'
import { useState } from 'react'
import useSWR from 'swr'
import { BASE, fetcher } from '@/lib/api'
import { AssetsTable } from '@/components/assets/AssetsTable'
import { AssetFormModal } from '@/components/assets/AssetFormModal'
import type { Asset } from '@/lib/types'

export default function AssetsPage() {
  const { data: assets, mutate } = useSWR<Asset[]>(`${BASE}/assets`, fetcher)
  const [modalOpen, setModalOpen] = useState(false)

  async function handleDelete(id: string) {
    if (!confirm('確認刪除？若有持倉或快照將無法刪除。')) return
    const res = await fetch(`${BASE}/assets/${id}`, { method: 'DELETE' })
    if (!res.ok) alert('刪除失敗：請先移除所有持倉與快照')
    else mutate()
  }

  return (
    <main className="p-6 max-w-5xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-xl font-bold">資產設定</h1>
        <button onClick={() => setModalOpen(true)}
          className="bg-[var(--color-accent)] text-white px-4 py-2 rounded">+ 新增資產</button>
      </div>
      <AssetsTable assets={assets ?? []} onDelete={handleDelete} />
      <AssetFormModal open={modalOpen} onClose={() => { setModalOpen(false); mutate() }} />
    </main>
  )
}
