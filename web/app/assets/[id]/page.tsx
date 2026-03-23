'use client'
import { use } from 'react'
import useSWR from 'swr'
import { BASE, fetcher } from '@/lib/api'
import { AssetDetailView } from '@/components/assets/AssetDetailView'
import type { Asset } from '@/lib/types'

export default function AssetDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { data: asset, isLoading } = useSWR<Asset>(`${BASE}/assets/${id}`, fetcher)

  if (isLoading) return <main className="p-6"><div className="animate-pulse h-40 bg-[var(--color-surface)] rounded-xl" /></main>
  if (!asset) return <main className="p-6"><p className="text-[var(--color-muted)]">找不到此資產</p></main>

  return (
    <main className="p-6 max-w-3xl mx-auto">
      <h1 className="text-xl font-bold mb-6">{asset.name}</h1>
      <AssetDetailView asset={asset} />
    </main>
  )
}
