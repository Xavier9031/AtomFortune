import { db } from '../../db/client'
import { dailySnapshotJob, backfillHistoricalPrices, backfillHistoricalFxRates } from '../../jobs/snapshot.job'
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

export async function rebuildDate(userId: string, date: string) {
  await dailySnapshotJob(db, new Date(date), { skipPriceFetch: true, userId })
  return { rebuilt: 1, missingAssets: [] as string[] }
}

export async function rebuildRange(userId: string, from: string, to: string) {
  // 1. Backfill historical FX rates from Yahoo Finance
  try {
    await backfillHistoricalFxRates(db, from, to)
  } catch (err) {
    console.warn('[rebuild-range] Historical FX fetch failed (continuing):', err)
  }

  // 2. Rebuild snapshots for every day in range
  const dates: string[] = []
  const current = new Date(from)
  const end = new Date(to)
  while (current <= end) {
    dates.push(current.toISOString().slice(0, 10))
    current.setDate(current.getDate() + 1)
  }
  for (const date of dates) {
    await dailySnapshotJob(db, new Date(date), { skipPriceFetch: true, userId })
  }
  return { rebuilt: dates.length, missingAssets: [] as string[] }
}

export async function backfillPricesOnly(userId: string, from: string, to: string) {
  const result = await backfillHistoricalPrices(db, from, to, userId)
  return result
}

export async function backfill(userId: string, from: string, to: string) {
  // 1. Fetch historical market prices from Yahoo Finance
  let pricesResult: Awaited<ReturnType<typeof backfillHistoricalPrices>> | null = null
  try {
    pricesResult = await backfillHistoricalPrices(db, from, to, userId)
    console.log(`[backfill] Inserted ${pricesResult.total} historical price records`)
  } catch (err) {
    console.warn('[backfill] Historical price fetch failed (continuing):', err)
  }

  // 2. Fetch historical FX rates from Yahoo Finance
  try {
    await backfillHistoricalFxRates(db, from, to)
  } catch (err) {
    console.warn('[backfill] Historical FX fetch failed (continuing):', err)
  }

  // 3. Rebuild snapshot for every day in range
  const dates: string[] = []
  const current = new Date(from)
  const end = new Date(to)
  while (current <= end) {
    dates.push(current.toISOString().slice(0, 10))
    current.setDate(current.getDate() + 1)
  }
  for (const date of dates) {
    await dailySnapshotJob(db, new Date(date), { skipPriceFetch: true, userId })
  }

  return {
    pricesBackfilled: pricesResult,
    snapshotsRebuilt: dates.length,
  }
}
