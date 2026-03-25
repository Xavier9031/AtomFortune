import { db } from '../../db/client'
import { dailySnapshotJob, backfillHistoricalPrices } from '../../jobs/snapshot.job'
import * as repo from './snapshots.repository'

type RangeParam = '30d' | '1y' | 'all'

export async function listHistory(userId: string, range: RangeParam) {
  return repo.getSnapshotHistory(db, userId, range)
}

export async function listItemsByAsset(userId: string, assetId: string, range: RangeParam) {
  return repo.getSnapshotItemsByAsset(db, userId, assetId, range)
}

export async function getDetail(userId: string, date: string) {
  return repo.getSnapshotByDate(db, userId, date)
}

export async function rebuildDate(date: string) {
  await dailySnapshotJob(db, new Date(date), { skipPriceFetch: true })
  return { rebuilt: 1, missingAssets: [] as string[] }
}

export async function rebuildRange(from: string, to: string) {
  const dates: string[] = []
  const current = new Date(from)
  const end = new Date(to)
  while (current <= end) {
    dates.push(current.toISOString().slice(0, 10))
    current.setDate(current.getDate() + 1)
  }
  for (const date of dates) {
    await dailySnapshotJob(db, new Date(date), { fxLookbackDays: 31, skipPriceFetch: true })
  }
  return { rebuilt: dates.length, missingAssets: [] as string[] }
}

export async function backfillPricesOnly(from: string, to: string) {
  const result = await backfillHistoricalPrices(db, from, to)
  return result
}

export async function backfill(from: string, to: string) {
  // 1. Fetch historical market prices from Yahoo Finance
  let pricesResult: Awaited<ReturnType<typeof backfillHistoricalPrices>> | null = null
  try {
    pricesResult = await backfillHistoricalPrices(db, from, to)
    console.log(`[backfill] Inserted ${pricesResult.total} historical price records`)
  } catch (err) {
    console.warn('[backfill] Historical price fetch failed (continuing):', err)
  }

  // 2. Rebuild snapshot for every day in range with extended FX lookback
  const dates: string[] = []
  const current = new Date(from)
  const end = new Date(to)
  while (current <= end) {
    dates.push(current.toISOString().slice(0, 10))
    current.setDate(current.getDate() + 1)
  }
  for (const date of dates) {
    await dailySnapshotJob(db, new Date(date), { fxLookbackDays: 31, skipPriceFetch: true })
  }

  return {
    pricesBackfilled: pricesResult,
    snapshotsRebuilt: dates.length,
  }
}
