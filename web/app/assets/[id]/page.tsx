import { notFound } from 'next/navigation'
import { AssetDetailView } from '@/components/assets/AssetDetailView'
import type { Asset } from '@/lib/types'

export default async function AssetDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8000/api/v1'
  const res = await fetch(`${apiBase}/assets/${id}`)
  if (!res.ok) notFound()
  const asset: Asset = await res.json()
  return (
    <main className="p-6 max-w-3xl mx-auto">
      <h1 className="text-xl font-bold mb-6">{asset.name}</h1>
      <AssetDetailView asset={asset} />
    </main>
  )
}
