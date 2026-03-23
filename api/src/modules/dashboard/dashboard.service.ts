import { db } from '../../db/client'
import * as repo from './dashboard.repository'
import { SUPPORTED_CURRENCIES, type SupportedCurrency as DisplayCurrency } from '../../currencies'

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

type AssetEntry = { assetId: string; name: string; category: string; value: number; assetClass: string }

export async function getLiveData(displayCurrency: DisplayCurrency) {
  const rows = await repo.getLiveHoldings(db)
  if (rows.length === 0) return null

  const assetMap = new Map<string, AssetEntry>()
  for (const row of rows) {
    const valueInBase = Number(row.quantity) * Number(row.price) * Number(row.fxToBase)
    const existing = assetMap.get(row.assetId)
    if (existing) existing.value += valueInBase
    else assetMap.set(row.assetId, {
      assetId: row.assetId, name: row.name,
      category: row.category, assetClass: row.assetClass, value: valueInBase,
    })
  }

  let totalAssets = 0, totalLiabilities = 0
  for (const { value, assetClass } of assetMap.values()) {
    if (assetClass === 'liability') totalLiabilities += value
    else totalAssets += value
  }

  const latestDate = await repo.getLatestSnapshotDate(db)
  const today = new Date().toISOString().slice(0, 10)
  const fxRate = await repo.getFxRateForDisplay(db, displayCurrency, latestDate ?? today)
  const netWorthTWD = totalAssets - totalLiabilities

  let changeAmount: number | null = null
  let changePct: number | null = null
  if (latestDate) {
    const prev = await repo.getSummaryForDate(db, latestDate)
    const prevNet = (Number(prev.totalAssets) - Number(prev.totalLiabilities)) / fxRate
    const liveNet = netWorthTWD / fxRate
    changeAmount = Math.round((liveNet - prevNet) * 100) / 100
    changePct = prevNet !== 0 ? Math.round((changeAmount / prevNet) * 10000) / 100 : null
  }

  const totalValue = totalAssets + totalLiabilities
  const grouped = new Map<string, AssetEntry[]>()
  for (const item of assetMap.values()) {
    if (!grouped.has(item.category)) grouped.set(item.category, [])
    grouped.get(item.category)!.push(item)
  }

  const categories = [...grouped.entries()].map(([cat, items]) => {
    const catValue = items.reduce((s, i) => s + i.value, 0)
    const meta = CATEGORY_META[cat] ?? { label: cat, color: '#888' }
    return {
      category: cat, label: meta.label, color: meta.color,
      value: Math.round(catValue / fxRate * 100) / 100,
      pct: totalValue > 0 ? Math.round((catValue / totalValue) * 10000) / 100 : 0,
      items: items.map(i => ({
        assetId: i.assetId, name: i.name,
        value: Math.round(i.value / fxRate * 100) / 100,
        pct: totalValue > 0 ? Math.round((i.value / totalValue) * 10000) / 100 : 0,
      })),
    }
  })

  return {
    displayCurrency,
    netWorth: Math.round(netWorthTWD / fxRate * 100) / 100,
    totalAssets: Math.round(totalAssets / fxRate * 100) / 100,
    totalLiabilities: Math.round(totalLiabilities / fxRate * 100) / 100,
    changeAmount, changePct, prevSnapshotDate: latestDate ?? null, categories,
  }
}

export async function getCategoryHistoryData(range: '30d' | '1y' | 'all', displayCurrency: DisplayCurrency) {
  const rows = await repo.getCategoryHistory(db, range)
  const latestDate = rows.length ? rows[rows.length - 1].snapshotDate : null
  const fxRate = latestDate ? await repo.getFxRateForDisplay(db, displayCurrency, latestDate) : 1.0

  const byDate = new Map<string, Map<string, number>>()
  for (const row of rows) {
    if (!byDate.has(row.snapshotDate)) byDate.set(row.snapshotDate, new Map())
    const catMap = byDate.get(row.snapshotDate)!
    const sign = row.assetClass === 'liability' ? -1 : 1
    catMap.set(row.category, (catMap.get(row.category) ?? 0) + sign * Number(row.value))
  }

  const data = [...byDate.entries()].map(([date, cats]) => {
    const point: Record<string, number | string> = { date }
    for (const [cat, val] of cats) {
      point[cat] = Math.round(val / fxRate * 100) / 100
    }
    return point
  })

  return { displayCurrency, data }
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
