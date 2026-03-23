'use client'
import { useState } from 'react'
import useSWR from 'swr'
import { BASE, fetcher } from '@/lib/api'
import { AssetsTable } from '@/components/assets/AssetsTable'
import { AssetSidePanel } from '@/components/assets/AssetSidePanel'
import type { Asset } from '@/lib/types'

export default function AssetsPage() {
  const { data: assets, mutate } = useSWR<Asset[]>(`${BASE}/assets`, fetcher)
  const [panelOpen, setPanelOpen] = useState(false)
  const [editAsset, setEditAsset] = useState<Asset | undefined>()

  function openEdit(a: Asset) { setEditAsset(a); setPanelOpen(true) }
  function openAdd() { setEditAsset(undefined); setPanelOpen(true) }

  return (
    <main className="p-6 max-w-5xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-xl font-bold">資產設定</h1>
        <button onClick={openAdd}
          className="bg-[var(--color-accent)] text-white px-4 py-2 rounded">+ 新增資產</button>
      </div>
      <AssetsTable assets={assets ?? []} onEdit={openEdit} />
      <AssetSidePanel open={panelOpen} asset={editAsset}
        onClose={() => { setPanelOpen(false); setEditAsset(undefined); mutate() }} />
    </main>
  )
}
