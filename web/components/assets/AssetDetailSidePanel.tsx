'use client'
import useSWR from 'swr'
import { BASE, fetcher } from '@/lib/api'
import { AssetDetailView } from './AssetDetailView'
import type { Asset } from '@/lib/types'

interface Props { open: boolean; asset: Asset | null; onClose: () => void }

export function AssetDetailSidePanel({ open, asset, onClose }: Props) {
  // Re-fetch the asset so AssetDetailView always gets fresh data
  const { data: fresh } = useSWR<Asset>(
    asset ? `${BASE}/assets/${asset.id}` : null,
    fetcher
  )

  const current = fresh ?? asset

  return (
    <>
      {/* Backdrop */}
      {open && (
        <div className="fixed inset-0 z-30 bg-black/20" onClick={onClose} />
      )}

      <div className={`fixed inset-y-0 right-0 w-[440px] bg-[var(--color-surface)] shadow-2xl
        transform transition-transform duration-300 z-40 flex flex-col
        ${open ? 'translate-x-0' : 'translate-x-full'}`}>

        {/* Header */}
        <div className="flex items-center h-14 px-4 border-b border-[var(--color-border)] shrink-0">
          <button onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full
              text-[var(--color-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-bg)]">
            ✕
          </button>
          <h2 className="flex-1 text-center font-semibold text-sm truncate px-2">
            {current?.name ?? ''}
          </h2>
          <div className="w-8" />
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-4 py-4">
          {current && <AssetDetailView asset={current} />}
        </div>
      </div>
    </>
  )
}
