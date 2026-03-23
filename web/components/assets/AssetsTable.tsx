'use client'
import type { Asset } from '@/lib/types'

const SUB_KIND_LABELS: Record<string, string> = {
  bank_account: '銀行存款', physical_cash: '現金', e_wallet: '電子錢包',
  stablecoin: '穩定幣', stock: '股票', etf: 'ETF', fund: '基金',
  crypto: '加密貨幣', precious_metal: '貴金屬', real_estate: '不動產',
  vehicle: '車輛', receivable: '應收款', credit_card: '信用卡',
  mortgage: '房貸', personal_loan: '個人貸款', other: '其他',
}
const PRICING_LABELS: Record<string, string> = {
  market: '市價', fixed: '固定', manual: '手動',
}

export function AssetsTable({ assets, onEdit }: { assets: Asset[]; onEdit: (a: Asset) => void }) {
  return (
    <div className="rounded-xl border border-[var(--color-border)] overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[var(--color-border)] bg-[var(--color-bg)]">
            <th className="px-4 py-3 text-left text-xs text-[var(--color-muted)] font-medium">名稱</th>
            <th className="px-4 py-3 text-left text-xs text-[var(--color-muted)] font-medium">類型</th>
            <th className="px-4 py-3 text-left text-xs text-[var(--color-muted)] font-medium">代號</th>
            <th className="px-4 py-3 text-left text-xs text-[var(--color-muted)] font-medium">幣別</th>
            <th className="px-4 py-3 text-left text-xs text-[var(--color-muted)] font-medium">報價</th>
          </tr>
        </thead>
        <tbody>
          {assets.map((a, i) => (
            <tr key={a.id} onClick={() => onEdit(a)}
              className={`cursor-pointer ${i < assets.length - 1 ? 'border-b border-[var(--color-border)]' : ''}
                hover:bg-[var(--color-bg)] transition-colors`}>
              <td className="px-4 py-3 whitespace-nowrap font-medium">{a.name}</td>
              <td className="px-4 py-3 whitespace-nowrap text-[var(--color-muted)]">
                {SUB_KIND_LABELS[a.subKind] ?? a.subKind}
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
                {PRICING_LABELS[a.pricingMode] ?? a.pricingMode}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
