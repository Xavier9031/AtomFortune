import { Hono } from 'hono'
import { db } from '../../db/client'
import {
  assets, accounts, holdings, transactions,
  prices, fxRates, snapshotItems,
} from '../../db/schema'

export const backupRouter = new Hono()

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

  const date = new Date().toISOString().slice(0, 10)
  c.header('Content-Disposition', `attachment; filename="atomfortune-backup-${date}.json"`)
  c.header('Content-Type', 'application/json')
  return c.body(JSON.stringify(payload, null, 2))
})

// ── Import ─────────────────────────────────────────────────────────────────

backupRouter.post('/import', async (c) => {
  let body: any
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON' }, 400)
  }

  if (body.version !== '1' || !body.data) {
    return c.json({ error: 'Unsupported backup format' }, 400)
  }

  const d = body.data
  const counts = { assets: 0, accounts: 0, holdings: 0, transactions: 0, prices: 0, fxRates: 0, snapshotItems: 0 }

  await db.transaction(async (tx) => {
    // assets
    if (Array.isArray(d.assets) && d.assets.length) {
      for (const row of d.assets) {
        await tx.insert(assets).values(row)
          .onConflictDoUpdate({ target: assets.id, set: {
            name: row.name, assetClass: row.assetClass, category: row.category,
            subKind: row.subKind, symbol: row.symbol, market: row.market,
            currencyCode: row.currencyCode, pricingMode: row.pricingMode,
            unit: row.unit, updatedAt: row.updatedAt,
          }})
      }
      counts.assets = d.assets.length
    }

    // accounts
    if (Array.isArray(d.accounts) && d.accounts.length) {
      for (const row of d.accounts) {
        await tx.insert(accounts).values(row)
          .onConflictDoUpdate({ target: accounts.id, set: {
            name: row.name, institution: row.institution,
            accountType: row.accountType, note: row.note, updatedAt: row.updatedAt,
          }})
      }
      counts.accounts = d.accounts.length
    }

    // holdings
    if (Array.isArray(d.holdings) && d.holdings.length) {
      for (const row of d.holdings) {
        await tx.insert(holdings).values(row)
          .onConflictDoUpdate({ target: [holdings.assetId, holdings.accountId], set: {
            quantity: row.quantity, updatedAt: row.updatedAt,
          }})
      }
      counts.holdings = d.holdings.length
    }

    // transactions
    if (Array.isArray(d.transactions) && d.transactions.length) {
      for (const row of d.transactions) {
        await tx.insert(transactions).values(row)
          .onConflictDoUpdate({ target: transactions.id, set: {
            txnType: row.txnType, quantity: row.quantity,
            txnDate: row.txnDate, note: row.note, updatedAt: row.updatedAt,
          }})
      }
      counts.transactions = d.transactions.length
    }

    // prices
    if (Array.isArray(d.prices) && d.prices.length) {
      for (const row of d.prices) {
        await tx.insert(prices).values(row)
          .onConflictDoUpdate({ target: [prices.assetId, prices.priceDate], set: {
            price: row.price, source: row.source, updatedAt: row.updatedAt,
          }})
      }
      counts.prices = d.prices.length
    }

    // fxRates
    if (Array.isArray(d.fxRates) && d.fxRates.length) {
      for (const row of d.fxRates) {
        await tx.insert(fxRates).values(row)
          .onConflictDoUpdate({
            target: [fxRates.fromCurrency, fxRates.toCurrency, fxRates.rateDate],
            set: { rate: row.rate, source: row.source, updatedAt: row.updatedAt },
          })
      }
      counts.fxRates = d.fxRates.length
    }

    // snapshotItems
    if (Array.isArray(d.snapshotItems) && d.snapshotItems.length) {
      for (const row of d.snapshotItems) {
        await tx.insert(snapshotItems).values(row)
          .onConflictDoUpdate({
            target: [snapshotItems.snapshotDate, snapshotItems.assetId, snapshotItems.accountId],
            set: {
              quantity: row.quantity, price: row.price,
              fxRate: row.fxRate, valueInBase: row.valueInBase, updatedAt: row.updatedAt,
            },
          })
      }
      counts.snapshotItems = d.snapshotItems.length
    }
  })

  return c.json({ ok: true, imported: counts })
})
