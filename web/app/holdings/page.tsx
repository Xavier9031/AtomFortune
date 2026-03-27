'use client'
import { useState } from 'react'
import { useTranslations } from 'next-intl'
import useSWR from 'swr'
import { BASE, fetcher } from '@/lib/api'
import { HoldingsList } from '@/components/holdings/HoldingsList'
import { HoldingSidePanel } from '@/components/holdings/HoldingSidePanel'
import type { Holding } from '@/lib/types'

export default function HoldingsPage() {
  const t = useTranslations('holdings')
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
    <main className="max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-xl font-bold">{t('title')}</h1>
        <button onClick={openAdd}
          className="bg-[var(--color-accent)] text-white px-3 md:px-4 py-2 rounded-lg text-sm font-medium shrink-0">{t('addButton')}</button>
      </div>
      <HoldingsList holdings={holdings ?? []} onRowClick={openEdit} />
      <HoldingSidePanel mode={panelMode} open={panelOpen}
        holding={selected} onClose={() => { setPanelOpen(false); mutate() }} />
    </main>
  )
}
