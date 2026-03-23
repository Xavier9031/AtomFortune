'use client'
import type { Holding } from '@/lib/types'
import { getHoldingUnit } from '@/lib/utils'

const SUB_KIND_LABELS: Record<string, string> = {
  bank_account: '銀行存款', physical_cash: '現金', e_wallet: '電子錢包', stablecoin: '穩定幣',
  stock: '股票', etf: 'ETF', fund: '基金', crypto: '加密貨幣', precious_metal: '實體貴金屬',
  real_estate: '不動產', vehicle: '車輛', receivable: '應收款',
  credit_card: '信用卡', mortgage: '房貸', personal_loan: '個人貸款', other: '其他',
}

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
  if (holdings.length === 0) {
    return (
      <div className="rounded-xl border border-[var(--color-border)] p-12 text-center text-sm text-[var(--color-muted)]">
        尚無持倉，點右上角「+ 新增持倉」開始
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-[var(--color-border)] overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[var(--color-border)] bg-[var(--color-bg)]">
            {['資產名稱', '帳戶', '機構', '類型', '數量', '估值 (TWD)'].map(h => (
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
                  {SUB_KIND_LABELS[h.subKind] ?? h.subKind}
                </span>
              </td>
              <td className="px-4 py-3 whitespace-nowrap">
                {parseFloat(String(h.quantity)).toLocaleString()}
                <span className="ml-1 text-xs text-[var(--color-muted)]">
                  {getHoldingUnit(h)}
                </span>
              </td>
              <td className="px-4 py-3 whitespace-nowrap text-[var(--color-muted)]">
                {h.latestValueInBase != null
                  ? Number(h.latestValueInBase).toLocaleString()
                  : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
