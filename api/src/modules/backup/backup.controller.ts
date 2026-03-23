import { Hono } from 'hono'
import { zipSync, unzipSync, strToU8, strFromU8 } from 'fflate'
import { db } from '../../db/client'
import {
  assets, accounts, holdings, transactions,
  prices, fxRates, snapshotItems,
} from '../../db/schema'

export const backupRouter = new Hono()

// Strip auto-managed timestamp columns so DB uses its own defaults on import
// Returns `any` intentionally — the backup JSON is untyped at runtime
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function strip(row: Record<string, any>): any {
  const { createdAt: _c, updatedAt: _u, ...rest } = row
  return rest
}

// ── Export ─────────────────────────────────────────────────────────────────

backupRouter.get('/export', async (c) => {
  const [
    assetRows, accountRows, holdingRows, txnRows,
    priceRows, fxRows, snapshotRows,
  ] = await Promise.all([
    db.select().from(assets),
    db.select().from(accounts),
    db.select().from(holdings),
    db.select().from(transactions),
    db.select().from(prices),
    db.select().from(fxRates),
    db.select().from(snapshotItems),
  ])

  const payload = {
    version: '1',
    exportedAt: new Date().toISOString(),
    data: {
      assets: assetRows,
      accounts: accountRows,
      holdings: holdingRows,
      transactions: txnRows,
      prices: priceRows,
      fxRates: fxRows,
      snapshotItems: snapshotRows,
    },
  }

  const jsonBytes = strToU8(JSON.stringify(payload, null, 2))
  const date = new Date().toISOString().slice(0, 10)
  const filename = `atomfortune-backup-${date}.json`
  const zipped = zipSync({ [filename]: jsonBytes })

  c.header('Content-Disposition', `attachment; filename="${filename.replace('.json', '.zip')}"`)
  c.header('Content-Type', 'application/zip')
  return c.body(zipped.buffer as ArrayBuffer)
})

// ── Import ─────────────────────────────────────────────────────────────────

backupRouter.post('/import', async (c) => {
  let body: any

  const contentType = c.req.header('content-type') ?? ''

  if (contentType.includes('multipart/form-data')) {
    // ZIP upload
    const formData = await c.req.formData()
    const file = formData.get('file') as File | null
    if (!file) return c.json({ error: 'Missing file field' }, 400)
    const buf = await file.arrayBuffer()
    try {
      const unzipped = unzipSync(new Uint8Array(buf))
      const jsonFile = Object.values(unzipped)[0]
      body = JSON.parse(strFromU8(jsonFile))
    } catch {
      return c.json({ error: 'Failed to unzip or parse backup file' }, 400)
    }
  } else {
    // Raw JSON (fallback)
    try { body = await c.req.json() } catch {
      return c.json({ error: 'Invalid JSON' }, 400)
    }
  }

  if (body.version !== '1' || !body.data) {
    return c.json({ error: 'Unsupported backup format' }, 400)
  }

  const d = body.data
  const counts = { assets: 0, accounts: 0, holdings: 0, transactions: 0, prices: 0, fxRates: 0, snapshotItems: 0 }

  await db.transaction(async (tx) => {
    if (Array.isArray(d.assets) && d.assets.length) {
      for (const row of d.assets) {
        const v = strip(row)
        await tx.insert(assets).values(v)
          .onConflictDoUpdate({ target: assets.id, set: {
            name: v.name, assetClass: v.assetClass, category: v.category,
            subKind: v.subKind, symbol: v.symbol, market: v.market,
            currencyCode: v.currencyCode, pricingMode: v.pricingMode, unit: v.unit,
          }})
      }
      counts.assets = d.assets.length
    }

    if (Array.isArray(d.accounts) && d.accounts.length) {
      for (const row of d.accounts) {
        const v = strip(row)
        await tx.insert(accounts).values(v)
          .onConflictDoUpdate({ target: accounts.id, set: {
            name: v.name, institution: v.institution,
            accountType: v.accountType, note: v.note,
          }})
      }
      counts.accounts = d.accounts.length
    }

    if (Array.isArray(d.holdings) && d.holdings.length) {
      for (const row of d.holdings) {
        const v = strip(row)
        await tx.insert(holdings).values(v)
          .onConflictDoUpdate({ target: [holdings.assetId, holdings.accountId], set: {
            quantity: v.quantity,
          }})
      }
      counts.holdings = d.holdings.length
    }

    if (Array.isArray(d.transactions) && d.transactions.length) {
      for (const row of d.transactions) {
        const v = strip(row)
        await tx.insert(transactions).values(v)
          .onConflictDoUpdate({ target: transactions.id, set: {
            txnType: v.txnType, quantity: v.quantity, txnDate: v.txnDate, note: v.note,
          }})
      }
      counts.transactions = d.transactions.length
    }

    if (Array.isArray(d.prices) && d.prices.length) {
      for (const row of d.prices) {
        const v = strip(row)
        await tx.insert(prices).values(v)
          .onConflictDoUpdate({ target: [prices.assetId, prices.priceDate], set: {
            price: v.price, source: v.source,
          }})
      }
      counts.prices = d.prices.length
    }

    if (Array.isArray(d.fxRates) && d.fxRates.length) {
      for (const row of d.fxRates) {
        const v = strip(row)
        await tx.insert(fxRates).values(v)
          .onConflictDoUpdate({
            target: [fxRates.fromCurrency, fxRates.toCurrency, fxRates.rateDate],
            set: { rate: v.rate, source: v.source },
          })
      }
      counts.fxRates = d.fxRates.length
    }

    if (Array.isArray(d.snapshotItems) && d.snapshotItems.length) {
      for (const row of d.snapshotItems) {
        const v = strip(row)
        await tx.insert(snapshotItems).values(v)
          .onConflictDoUpdate({
            target: [snapshotItems.snapshotDate, snapshotItems.assetId, snapshotItems.accountId],
            set: {
              quantity: v.quantity, price: v.price,
              fxRate: v.fxRate, valueInBase: v.valueInBase,
            },
          })
      }
      counts.snapshotItems = d.snapshotItems.length
    }
  })

  return c.json({ ok: true, imported: counts })
})
