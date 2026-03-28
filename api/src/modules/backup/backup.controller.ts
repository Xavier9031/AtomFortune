import { Hono } from 'hono'
import { zipSync, unzipSync, strToU8, strFromU8 } from 'fflate'
import { eq } from 'drizzle-orm'
import crypto from 'crypto'
import { db } from '../../db/client'
import { backfillHistoricalPrices, backfillHistoricalFxRates } from '../../jobs/snapshot.job'
import {
  assets, accounts, holdings, transactions,
  prices, fxRates, snapshotItems, recurringEntries, users,
} from '../../db/schema'

export const backupRouter = new Hono()

// Strip auto-managed timestamp columns
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function strip(row: Record<string, any>): any {
  const { createdAt: _c, updatedAt: _u, ...rest } = row
  return rest
}

// ── AES-256-GCM helpers ─────────────────────────────────────────────────────

function encryptBackup(plaintext: string, password: string): Uint8Array {
  const salt = crypto.randomBytes(16)
  const iv = crypto.randomBytes(16)
  const key = crypto.scryptSync(password, salt, 32)
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()
  // Wire format: salt(16) + iv(16) + authTag(16) + ciphertext
  return new Uint8Array(Buffer.concat([salt, iv, authTag, encrypted]))
}

function decryptBackup(data: Uint8Array, password: string): string {
  const buf = Buffer.from(data)
  const salt = buf.subarray(0, 16)
  const iv = buf.subarray(16, 32)
  const authTag = buf.subarray(32, 48)
  const ciphertext = buf.subarray(48)
  const key = crypto.scryptSync(password, salt, 32)
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(authTag)
  return decipher.update(ciphertext) + decipher.final('utf8')
}

// ── Export ───────────────────────────────────────────────────────────────────

backupRouter.get('/export', async (c) => {
  // Accept userId from header (API clients) or query param (direct browser download links)
  const userId = c.req.header('x-user-id') ?? c.req.query('userId')
  if (!userId) return c.json({ error: 'Missing X-User-Id header' }, 400)

  const password = c.req.query('password')
  const date = new Date().toISOString().slice(0, 10)

  const [
    userRow,
    assetRows, accountRows, holdingRows, txnRows,
    priceRows, fxRows, snapshotRows, recurringRows,
  ] = await Promise.all([
    db.select({ name: users.name }).from(users).where(eq(users.id, userId)).then(r => r[0]),
    db.select().from(assets).where(eq(assets.userId, userId)),
    db.select().from(accounts).where(eq(accounts.userId, userId)),
    db.select().from(holdings).where(eq(holdings.userId, userId)),
    db.select().from(transactions).where(eq(transactions.userId, userId)),
    db.select().from(prices),          // global
    db.select().from(fxRates),         // global
    db.select().from(snapshotItems).where(eq(snapshotItems.userId, userId)),
    db.select().from(recurringEntries).where(eq(recurringEntries.userId, userId)),
  ])

  const payload = {
    version: '2',
    exportedAt: new Date().toISOString(),
    data: {
      assets: assetRows,
      accounts: accountRows,
      holdings: holdingRows,
      transactions: txnRows,
      prices: priceRows,
      fxRates: fxRows,
      snapshotItems: snapshotRows,
      recurringEntries: recurringRows,
    },
  }

  const jsonStr = JSON.stringify(payload, null, 2)

  let fileEntry: Record<string, Uint8Array>
  let baseFilename: string

  const rawName = userRow?.name ?? 'backup'
  const safeName = rawName.replace(/[^a-zA-Z0-9_-]/g, '_')
  if (password) {
    baseFilename = `AF-${safeName}-${date}.enc`
    fileEntry = { [baseFilename]: encryptBackup(jsonStr, password) }
  } else {
    baseFilename = `AF-${safeName}-${date}.json`
    fileEntry = { [baseFilename]: strToU8(jsonStr) }
  }

  const zipped = zipSync(fileEntry)
  const zipFilename = baseFilename.replace(/\.(json|enc)$/, '.zip')
  const zipDisplayName = `AF-${rawName}-${date}.zip`

  c.header('Content-Disposition', `attachment; filename="${zipFilename}"; filename*=UTF-8''${encodeURIComponent(zipDisplayName)}`)
  c.header('Content-Type', 'application/zip')
  return c.body(zipped.buffer as ArrayBuffer)
})

// ── Import ────────────────────────────────────────────────────────────────────

backupRouter.post('/import', async (c) => {
  const userId = c.req.header('x-user-id')
  if (!userId) return c.json({ error: 'Missing X-User-Id header' }, 400)

  const contentType = c.req.header('content-type') ?? ''
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let body: any

  if (contentType.includes('multipart/form-data')) {
    const formData = await c.req.formData()
    const file = formData.get('file') as File | null
    if (!file) return c.json({ error: 'Missing file field' }, 400)

    const buf = await file.arrayBuffer()
    try {
      const unzipped = unzipSync(new Uint8Array(buf))
      const filename = Object.keys(unzipped)[0]
      const fileData = unzipped[filename]

      if (filename.endsWith('.enc')) {
        const password = c.req.header('x-backup-password')
        if (!password) return c.json({ error: 'Missing X-Backup-Password header for encrypted backup' }, 400)
        try {
          const decrypted = decryptBackup(fileData, password)
          body = JSON.parse(decrypted)
        } catch {
          return c.json({ error: 'Decryption failed — wrong password or corrupted file' }, 400)
        }
      } else {
        body = JSON.parse(strFromU8(fileData))
      }
    } catch (e) {
      return c.json({ error: 'Failed to unzip or parse backup file' }, 400)
    }
  } else {
    try { body = await c.req.json() } catch {
      return c.json({ error: 'Invalid JSON' }, 400)
    }
  }

  if (!['1', '2'].includes(body.version) || !body.data) {
    return c.json({ error: 'Unsupported backup format' }, 400)
  }

  const d = body.data
  const counts = {
    assets: 0, accounts: 0, holdings: 0, transactions: 0,
    prices: 0, fxRates: 0, snapshotItems: 0, recurringEntries: 0,
  }

  // Remap old UUIDs → new UUIDs so importing to a different user never
  // collides with existing rows owned by another user.
  const assetIdMap = new Map<string, string>()
  const accountIdMap = new Map<string, string>()
  if (Array.isArray(d.assets)) {
    for (const row of d.assets) assetIdMap.set(row.id, crypto.randomUUID())
  }
  if (Array.isArray(d.accounts)) {
    for (const row of d.accounts) accountIdMap.set(row.id, crypto.randomUUID())
  }

  db.transaction((tx) => {
    if (Array.isArray(d.assets) && d.assets.length) {
      for (const row of d.assets) {
        const v = { ...strip(row), id: assetIdMap.get(row.id)!, userId }
        tx.insert(assets).values(v).run()
      }
      counts.assets = d.assets.length
    }

    if (Array.isArray(d.accounts) && d.accounts.length) {
      for (const row of d.accounts) {
        const v = { ...strip(row), id: accountIdMap.get(row.id)!, userId }
        tx.insert(accounts).values(v).run()
      }
      counts.accounts = d.accounts.length
    }

    if (Array.isArray(d.holdings) && d.holdings.length) {
      for (const row of d.holdings) {
        const newAssetId = assetIdMap.get(row.assetId)
        const newAccountId = accountIdMap.get(row.accountId)
        if (!newAssetId || !newAccountId) continue
        const v = { ...strip(row), assetId: newAssetId, accountId: newAccountId, userId }
        tx.insert(holdings).values(v).run()
      }
      counts.holdings = d.holdings.length
    }

    if (Array.isArray(d.transactions) && d.transactions.length) {
      for (const row of d.transactions) {
        const newAssetId = assetIdMap.get(row.assetId)
        const newAccountId = accountIdMap.get(row.accountId)
        if (!newAssetId || !newAccountId) continue
        const v = { ...strip(row), id: crypto.randomUUID(), assetId: newAssetId, accountId: newAccountId, userId }
        tx.insert(transactions).values(v).run()
      }
      counts.transactions = d.transactions.length
    }

    if (Array.isArray(d.prices) && d.prices.length) {
      for (const row of d.prices) {
        const newAssetId = assetIdMap.get(row.assetId)
        if (!newAssetId) continue  // skip prices for assets not in this backup
        const v = { ...strip(row), assetId: newAssetId }
        tx.insert(prices).values(v)
          .onConflictDoUpdate({ target: [prices.assetId, prices.priceDate], set: {
            price: v.price, source: v.source,
          }}).run()
      }
      counts.prices = d.prices.length
    }

    if (Array.isArray(d.fxRates) && d.fxRates.length) {
      for (const row of d.fxRates) {
        const v = strip(row)
        tx.insert(fxRates).values(v)
          .onConflictDoUpdate({
            target: [fxRates.fromCurrency, fxRates.toCurrency, fxRates.rateDate],
            set: { rate: v.rate, source: v.source },
          }).run()
      }
      counts.fxRates = d.fxRates.length
    }

    if (Array.isArray(d.snapshotItems) && d.snapshotItems.length) {
      for (const row of d.snapshotItems) {
        const newAssetId = assetIdMap.get(row.assetId)
        const newAccountId = accountIdMap.get(row.accountId)
        if (!newAssetId || !newAccountId) continue
        const v = { ...strip(row), assetId: newAssetId, accountId: newAccountId, userId }
        tx.insert(snapshotItems).values(v)
          .onConflictDoUpdate({
            target: [snapshotItems.snapshotDate, snapshotItems.assetId, snapshotItems.accountId],
            set: {
              quantity: v.quantity, price: v.price,
              fxRate: v.fxRate, valueInBase: v.valueInBase,
            },
          }).run()
      }
      counts.snapshotItems = d.snapshotItems.length
    }

    if (Array.isArray(d.recurringEntries) && d.recurringEntries.length) {
      for (const row of d.recurringEntries) {
        const newAssetId = row.assetId ? assetIdMap.get(row.assetId) : null
        const newAccountId = row.accountId ? accountIdMap.get(row.accountId) : null
        if (row.assetId && !newAssetId) continue
        if (row.accountId && !newAccountId) continue
        const v = { ...strip(row), id: crypto.randomUUID(), assetId: newAssetId ?? null, accountId: newAccountId ?? null, userId }
        tx.insert(recurringEntries).values(v).run()
      }
      counts.recurringEntries = d.recurringEntries.length
    }
  })

  // Fire-and-forget: backfill historical prices + FX for imported data
  const snapshotDates = (d.snapshotItems ?? []).map((s: any) => s.snapshotDate).filter(Boolean)
  if (snapshotDates.length > 0) {
    const earliest = snapshotDates.sort()[0]
    const today = new Date().toISOString().slice(0, 10)
    Promise.all([
      backfillHistoricalPrices(db, earliest, today).catch(err => console.warn('[import] Price backfill failed:', err)),
      backfillHistoricalFxRates(db, earliest, today).catch(err => console.warn('[import] FX backfill failed:', err)),
    ]).then(() => console.log(`[import] Backfill complete from ${earliest} to ${today}`))
  }

  return c.json({ ok: true, imported: counts })
})

// ── Reset ─────────────────────────────────────────────────────────────────────

backupRouter.delete('/reset', (c) => {
  const userId = c.req.header('x-user-id')
  if (!userId) return c.json({ error: 'Missing X-User-Id header' }, 400)

  db.transaction((tx) => {
    tx.delete(snapshotItems).where(eq(snapshotItems.userId, userId)).run()
    tx.delete(recurringEntries).where(eq(recurringEntries.userId, userId)).run()
    tx.delete(transactions).where(eq(transactions.userId, userId)).run()
    tx.delete(holdings).where(eq(holdings.userId, userId)).run()
    tx.delete(accounts).where(eq(accounts.userId, userId)).run()
    tx.delete(assets).where(eq(assets.userId, userId)).run()
  })
  return c.json({ ok: true })
})
