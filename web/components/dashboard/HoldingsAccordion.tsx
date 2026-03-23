'use client'
import Link from 'next/link'
import type { AllocationData, Category } from '@/lib/types'
import { categoryColor, formatValue } from '@/lib/utils'
import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'

interface Props { data: AllocationData; expandedCategory: Category | null }

export default function HoldingsAccordion({ data, expandedCategory }: Props) {
  const [localExpanded, setLocalExpanded] = useState<Category | null>(null)
  const active = expandedCategory ?? localExpanded

  return (
    <div className="mt-4 space-y-2">
      {data.categories.map(cat => (
        <div key={cat.category} className="rounded-lg border border-border overflow-hidden">
          <button
            onClick={() => setLocalExpanded(active === cat.category ? null : cat.category)}
            className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold bg-surface"
          >
            <span className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full" style={{ background: categoryColor(cat.category) }} />
              {cat.label}
              <span className="text-muted font-normal">{cat.pct.toFixed(1)}%</span>
            </span>
            <span className="flex items-center gap-2">
              <span>{formatValue(cat.value, data.displayCurrency)}</span>
              {active === cat.category ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </span>
          </button>
          {active === cat.category && (
            <ul className="divide-y divide-border bg-bg">
              {cat.items.map(item => (
                <li key={item.assetId}>
                  <Link
                    href={`/assets/${item.assetId}`}
                    className="flex justify-between px-6 py-2 text-sm hover:bg-surface transition-colors"
                  >
                    <span>{item.name}</span>
                    <span className="text-muted">{formatValue(item.value, data.displayCurrency)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </div>
  )
}
