'use client'
import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import useSWR from 'swr'
import { BASE, fetcher } from '@/lib/api'
import { AssetsTable } from '@/components/assets/AssetsTable'
import { AssetSidePanel } from '@/components/assets/AssetSidePanel'
import type { Asset } from '@/lib/types'

export default function AssetsPage() {
  const t = useTranslations('assets')
  const router = useRouter()
  const { data: assets, mutate } = useSWR<Asset[]>(`${BASE}/assets`, fetcher)
  const [panelOpen, setPanelOpen] = useState(false)

  return (
    <main className="p-6 max-w-5xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-xl font-bold">{t('title')}</h1>
        <button onClick={() => setPanelOpen(true)}
          className="bg-[var(--color-accent)] text-white px-4 py-2 rounded">{t('addButton')}</button>
      </div>
      <AssetsTable assets={assets ?? []} onNavigate={a => router.push(`/assets/${a.id}`)} />
      <AssetSidePanel open={panelOpen}
        onClose={() => { setPanelOpen(false); mutate() }} />
    </main>
  )
}
