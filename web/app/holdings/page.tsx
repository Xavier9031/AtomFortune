'use client'
import { useState } from 'react'
import useSWR from 'swr'
import { BASE, fetcher } from '@/lib/api'
import { HoldingsList } from '@/components/holdings/HoldingsList'
import { HoldingSidePanel } from '@/components/holdings/HoldingSidePanel'
import type { Holding } from '@/lib/types'

export default function HoldingsPage() {
  const { data: holdings, mutate } = useSWR<Holding[]>(`${BASE}/holdings`, fetcher)
  const [panelOpen, setPanelOpen] = useState(false)
  const [panelMode, setPanelMode] = useState<'add' | 'edit'>('add')
  const [selected, setSelected] = useState<Holding | undefined>()

  function openEdit(h: Holding) {
    setSelected(h); setPanelMode('edit'); setPanelOpen(true)
  }
  function openAdd() {
    setSelected(undefined); setPanelMode('add'); setPanelOpen(true)
  }

  return (
    <main className="p-6 max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-xl font-bold">持倉管理</h1>
        <button onClick={openAdd}
          className="bg-[var(--color-accent)] text-white px-4 py-2 rounded">+ 新增持倉</button>
      </div>
      <HoldingsList holdings={holdings ?? []} onRowClick={openEdit} />
      <HoldingSidePanel mode={panelMode} open={panelOpen}
        holding={selected} onClose={() => { setPanelOpen(false); mutate() }} />
    </main>
  )
}
