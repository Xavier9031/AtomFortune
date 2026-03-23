'use client'
import { useTranslations } from 'next-intl'
import type { Asset } from '@/lib/types'

export function AssetsTable({ assets, onNavigate }: { assets: Asset[]; onNavigate: (a: Asset) => void }) {
  const t = useTranslations()
  return (
    <div className="rounded-xl border border-[var(--color-border)] overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[var(--color-border)] bg-[var(--color-bg)]">
            {[
              t('assets.columns.name'),
              t('assets.columns.type'),
              t('assets.columns.symbol'),
              t('assets.columns.currency'),
              t('assets.columns.pricing'),
            ].map(h => (
              <th key={h} className="px-4 py-3 text-left text-xs text-[var(--color-muted)] font-medium">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {assets.map((a, i) => (
            <tr key={a.id} onClick={() => onNavigate(a)}
              className={`cursor-pointer ${i < assets.length - 1 ? 'border-b border-[var(--color-border)]' : ''}
                hover:bg-[var(--color-bg)] transition-colors`}>
              <td className="px-4 py-3 whitespace-nowrap font-medium">{a.name}</td>
              <td className="px-4 py-3 whitespace-nowrap text-[var(--color-muted)]">
                {t(`asset.subKinds.${a.subKind}` as Parameters<typeof t>[0], { defaultValue: a.subKind })}
              </td>
              <td className="px-4 py-3 whitespace-nowrap">
                {a.symbol
                  ? <span className="px-2 py-0.5 bg-[var(--color-text)] text-[var(--color-surface)] rounded-full text-xs font-bold">
                      {a.symbol}
                    </span>
                  : <span className="text-[var(--color-muted)]">—</span>}
              </td>
              <td className="px-4 py-3 whitespace-nowrap">{a.currencyCode}</td>
              <td className="px-4 py-3 whitespace-nowrap text-[var(--color-muted)]">
                {t(`asset.pricingModes.${a.pricingMode}` as Parameters<typeof t>[0], { defaultValue: a.pricingMode })}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
