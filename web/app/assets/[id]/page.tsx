'use client'
import { use } from 'react'
import { useRouter } from 'next/navigation'
import useSWR from 'swr'
import { BASE, fetcher } from '@/lib/api'
import { AssetDetailView } from '@/components/assets/AssetDetailView'
import type { Asset } from '@/lib/types'

export default function AssetDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const { data: asset, isLoading } = useSWR<Asset>(`${BASE}/assets/${id}`, fetcher)

  if (isLoading) return <main className="p-6"><div className="animate-pulse h-40 bg-[var(--color-surface)] rounded-xl" /></main>
  if (!asset) return <main className="p-6"><p className="text-[var(--color-muted)]">找不到此資產</p></main>

  return (
    <main className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.back()}
          className="text-[var(--color-muted)] hover:text-[var(--color-text)] text-xl leading-none">‹</button>
        <h1 className="text-xl font-bold">{asset.name}</h1>
      </div>
      <AssetDetailView asset={asset} />
    </main>
  )
}
