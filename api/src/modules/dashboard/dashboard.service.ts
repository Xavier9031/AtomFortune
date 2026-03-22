import { db } from '../../db/client'
import * as repo from './dashboard.repository'

const VALID_CURRENCIES = ['TWD', 'USD', 'JPY'] as const
type DisplayCurrency = typeof VALID_CURRENCIES[number]

const CATEGORY_META: Record<string, { label: string; color: string }> = {
  liquid:     { label: '流動資金', color: '#078080' },
  investment: { label: '投資',     color: '#7c3aed' },
  fixed:      { label: '固定資產', color: '#1d4ed8' },
  receivable: { label: '應收款',   color: '#f59e0b' },
  debt:       { label: '負債',     color: '#f45d48' },
}

export async function getSummary(displayCurrency: DisplayCurrency) {
  const latestDate = await repo.getLatestSnapshotDate(db)
  if (!latestDate) return null

  const { totalAssets, totalLiabilities } = await repo.getSummaryForDate(db, latestDate)
  const fxRate = await repo.getFxRateForDisplay(db, displayCurrency, latestDate)
  const prevSummary = await repo.getPreviousSummary(db, latestDate)

  const netWorthTWD = Number(totalAssets) - Number(totalLiabilities)
  const netWorth = netWorthTWD / fxRate

  let changeAmount: number | null = null
  let changePct: number | null = null
  if (prevSummary) {
    const prevNet = Number(prevSummary.netWorth) / fxRate
    changeAmount = netWorth - prevNet
    changePct = prevNet !== 0 ? (changeAmount / prevNet) * 100 : null
  }

  return {
    snapshotDate: latestDate,
    displayCurrency,
    netWorth: Math.round(netWorth * 100) / 100,
    totalAssets: Math.round(Number(totalAssets) / fxRate * 100) / 100,
    totalLiabilities: Math.round(Number(totalLiabilities) / fxRate * 100) / 100,
    changeAmount: changeAmount !== null ? Math.round(changeAmount * 100) / 100 : null,
    changePct: changePct !== null ? Math.round(changePct * 100) / 100 : null,
    missingAssets: [] as string[],
  }
}

export async function getAllocation(date: string | undefined, displayCurrency: DisplayCurrency) {
  const snapshotDate = date ?? await repo.getLatestSnapshotDate(db)
  if (!snapshotDate) return null

  const rows = await repo.getAllocationForDate(db, snapshotDate)
  const fxRate = await repo.getFxRateForDisplay(db, displayCurrency, snapshotDate)
  const totalValue = rows.reduce((s, r) => s + Number(r.valueInBase), 0)

  const grouped = new Map<string, typeof rows>()
  for (const row of rows) {
    if (!grouped.has(row.category)) grouped.set(row.category, [])
    grouped.get(row.category)!.push(row)
  }

  const categories = [...grouped.entries()].map(([cat, items]) => {
    const catValue = items.reduce((s, i) => s + Number(i.valueInBase), 0)
    const meta = CATEGORY_META[cat] ?? { label: cat, color: '#888' }
    return {
      category: cat,
      label: meta.label,
      value: Math.round(catValue / fxRate * 100) / 100,
      pct: totalValue > 0 ? Math.round((catValue / totalValue) * 10000) / 100 : 0,
      color: meta.color,
      items: items.map(i => ({
        assetId: i.assetId,
        name: i.name,
        value: Math.round(Number(i.valueInBase) / fxRate * 100) / 100,
        pct: totalValue > 0 ? Math.round((Number(i.valueInBase) / totalValue) * 10000) / 100 : 0,
      })),
    }
  })

  return { snapshotDate, displayCurrency, categories }
}

export async function getNetWorthHistoryData(range: '30d' | '1y' | 'all', displayCurrency: DisplayCurrency) {
  const rows = await repo.getNetWorthHistory(db, range)
  const latestDate = rows.length ? rows[rows.length - 1].snapshotDate : null
  const fxRate = latestDate ? await repo.getFxRateForDisplay(db, displayCurrency, latestDate) : 1.0

  return {
    displayCurrency,
    data: rows.map(r => ({
      date: r.snapshotDate,
      netWorth: Math.round(Number(r.netWorth) / fxRate * 100) / 100,
    })),
  }
}
