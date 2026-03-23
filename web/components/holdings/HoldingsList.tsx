'use client'
import { useTranslations } from 'next-intl'
import useSWR from 'swr'
import type { Holding } from '@/lib/types'
import { getHoldingUnit } from '@/lib/utils'
import { BASE, fetcher } from '@/lib/api'
import { useCurrency } from '@/context/CurrencyContext'

const ZERO_DEC_DISPLAY = new Set(['TWD', 'JPY', 'KRW'])

const CATEGORY_COLOR: Record<string, string> = {
  liquid: 'bg-green-100 text-green-700',
  investment: 'bg-indigo-100 text-indigo-700',
  fixed: 'bg-violet-100 text-violet-700',
  receivable: 'bg-sky-100 text-sky-700',
  debt: 'bg-red-100 text-red-600',
}

interface Props {
  holdings: Holding[]
  onRowClick: (h: Holding) => void
}

export function HoldingsList({ holdings, onRowClick }: Props) {
  const t = useTranslations()
  const { currency } = useCurrency()
  const { data: fxRows } = useSWR<{ rate: string }[]>(
    currency !== 'TWD' ? `${BASE}/fx-rates?from=${currency}&to=TWD` : null,
    fetcher
  )
  const fxRate = currency === 'TWD' ? 1 : (fxRows?.[0]?.rate ? Number(fxRows[0].rate) : null)

  function fmtValue(raw: string | number | null): string {
    if (raw == null || raw === '') return '—'
    if (fxRate == null) return '…'
    const converted = Number(raw) / fxRate
    const dec = ZERO_DEC_DISPLAY.has(currency) ? 0 : 2
    return new Intl.NumberFormat('zh-TW', { maximumFractionDigits: dec }).format(converted)
  }

  if (holdings.length === 0) {
    return (
      <div className="rounded-xl border border-[var(--color-border)] p-12 text-center text-sm text-[var(--color-muted)]">
        {t('holdings.empty')}
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-[var(--color-border)] overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[var(--color-border)] bg-[var(--color-bg)]">
            {[
              t('holdings.columns.assetName'),
              t('holdings.columns.account'),
              t('holdings.columns.institution'),
              t('holdings.columns.type'),
              t('holdings.columns.quantity'),
              `${t('holdings.columns.value')} (${currency})`,
            ].map(h => (
              <th key={h} className="px-4 py-3 text-left text-xs text-[var(--color-muted)] font-medium">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {holdings.map((h, i) => (
            <tr key={`${h.assetId}-${h.accountId}`}
              onClick={() => onRowClick(h)}
              className={`cursor-pointer hover:bg-[var(--color-bg)] transition-colors
                ${i < holdings.length - 1 ? 'border-b border-[var(--color-border)]' : ''}`}>
              <td className="px-4 py-3 whitespace-nowrap font-medium">{h.assetName}</td>
              <td className="px-4 py-3 whitespace-nowrap">{h.accountName}</td>
              <td className="px-4 py-3 whitespace-nowrap text-[var(--color-muted)]">
                {h.institution ?? '—'}
              </td>
              <td className="px-4 py-3 whitespace-nowrap">
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium
                  ${CATEGORY_COLOR[h.category] ?? 'bg-[var(--color-bg)] text-[var(--color-muted)]'}`}>
                  {t(`asset.subKinds.${h.subKind}` as Parameters<typeof t>[0], { defaultValue: h.subKind })}
                </span>
              </td>
              <td className="px-4 py-3 whitespace-nowrap">
                {parseFloat(String(h.quantity)).toLocaleString()}
                <span className="ml-1 text-xs text-[var(--color-muted)]">
                  {getHoldingUnit(h)}
                </span>
              </td>
              <td className="px-4 py-3 whitespace-nowrap text-[var(--color-muted)]">
                {fmtValue(h.latestValueInBase)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
