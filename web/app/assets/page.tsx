'use client'
import { useState } from 'react'
import { useTranslations } from 'next-intl'
import useSWR from 'swr'
import { BASE, fetcher } from '@/lib/api'
import { AssetsTable } from '@/components/assets/AssetsTable'
import { AssetSidePanel } from '@/components/assets/AssetSidePanel'
import { AssetDetailSidePanel } from '@/components/assets/AssetDetailSidePanel'
import type { Asset } from '@/lib/types'

export default function AssetsPage() {
  const t = useTranslations('assets')
  const { data: assets, mutate } = useSWR<Asset[]>(`${BASE}/assets`, fetcher)
  const [addOpen, setAddOpen] = useState(false)
  const [selected, setSelected] = useState<Asset | null>(null)

  return (
    <main className="max-w-5xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-xl font-bold">{t('title')}</h1>
        <button onClick={() => setAddOpen(true)}
          className="bg-[var(--color-accent)] text-white px-3 md:px-4 py-2 rounded-lg text-sm font-medium shrink-0">{t('addButton')}</button>
      </div>
      <AssetsTable assets={assets ?? []} onNavigate={a => setSelected(a)} />
      <AssetSidePanel open={addOpen}
        onClose={() => { setAddOpen(false); mutate() }} />
      <AssetDetailSidePanel
        open={selected !== null}
        asset={selected}
        onClose={() => { setSelected(null); mutate() }}
      />
    </main>
  )
}
