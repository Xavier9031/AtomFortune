import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import app from '../src/index'
import { cleanDb, closeDb, testDb, seedTestUser } from './helpers/db'
import { assets, accounts, prices } from '../src/db/schema'
import { unzipSync, strFromU8 } from 'fflate'

beforeEach(() => cleanDb())
afterAll(() => closeDb())

describe('GET /api/v1/backup/export (with X-User-Id)', () => {
  it('returns 400 when X-User-Id is missing', async () => {
    const res = await app.request('/api/v1/backup/export')
    expect(res.status).toBe(400)
  })

  it('returns a zip containing backup.json for correct user', async () => {
    const user = await seedTestUser()
    const otherUser = await seedTestUser('Other')
    await testDb.insert(assets).values({
      userId: user.id,
      name: 'Cash', assetClass: 'asset', category: 'liquid',
      subKind: 'bank_account', currencyCode: 'TWD', pricingMode: 'fixed',
    })
    const [otherAsset] = await testDb.insert(assets).values({
      userId: otherUser.id,
      name: 'Other Asset', assetClass: 'asset', category: 'investment',
      subKind: 'fund', currencyCode: 'USD', pricingMode: 'manual',
    }).returning()
    await testDb.insert(prices).values({
      assetId: otherAsset.id,
      priceDate: '2026-03-22',
      price: '123.45',
      source: 'manual',
    })
    const res = await app.request('/api/v1/backup/export', {
      headers: { 'x-user-id': user.id },
    })
    expect(res.status).toBe(200)
    const buf = await res.arrayBuffer()
    const unzipped = unzipSync(new Uint8Array(buf))
    const filename = Object.keys(unzipped)[0]
    expect(filename).toMatch(/\.json$/)
    const parsed = JSON.parse(strFromU8(unzipped[filename]))
    expect(parsed.data.assets).toHaveLength(1)
    expect(parsed.data.assets[0].name).toBe('Cash')
    expect(parsed.data.prices).toHaveLength(0)
  })

  it('returns encrypted .enc file when password is provided', async () => {
    const user = await seedTestUser()
    const res = await app.request('/api/v1/backup/export', {
      headers: { 'x-user-id': user.id, 'x-backup-password': 's3cret' },
    })
    expect(res.status).toBe(200)
    const buf = await res.arrayBuffer()
    const unzipped = unzipSync(new Uint8Array(buf))
    const filename = Object.keys(unzipped)[0]
    expect(filename).toMatch(/\.enc$/)
    // Should be binary data, not parseable as JSON
    expect(() => JSON.parse(strFromU8(unzipped[filename]))).toThrow()
  })
})

describe('POST /api/v1/backup/import (with X-User-Id)', () => {
  it('imports encrypted backup when correct password provided', async () => {
    const user = await seedTestUser()
    await testDb.insert(accounts).values({
      userId: user.id, name: 'MyBank', accountType: 'bank',
    })
    const exportRes = await app.request('/api/v1/backup/export', {
      headers: { 'x-user-id': user.id, 'x-backup-password': 'mypassword' },
    })
    const zipBuf = await exportRes.arrayBuffer()
    // Clean up and re-import
    cleanDb()
    const newUser = await seedTestUser()
    const form = new FormData()
    form.append('file', new Blob([zipBuf], { type: 'application/zip' }), 'backup.zip')
    const importRes = await app.request('/api/v1/backup/import', {
      method: 'POST',
      headers: { 'x-user-id': newUser.id, 'x-backup-password': 'mypassword' },
      body: form,
    })
    expect(importRes.status).toBe(200)
    const body = await importRes.json()
    expect(body.imported.accounts).toBe(1)
  })
})

describe('DELETE /api/v1/backup/reset (with X-User-Id)', () => {
  it('returns 400 when X-User-Id is missing', async () => {
    const res = await app.request('/api/v1/backup/reset', { method: 'DELETE' })
    expect(res.status).toBe(400)
  })

  it('deletes only the current user data and returns ok', async () => {
    const userA = await seedTestUser('User A')
    const userB = await seedTestUser('User B')
    await testDb.insert(assets).values({
      userId: userA.id,
      name: 'A-Asset', assetClass: 'asset', category: 'liquid',
      subKind: 'bank_account', currencyCode: 'TWD', pricingMode: 'fixed',
    })
    await testDb.insert(assets).values({
      userId: userB.id,
      name: 'B-Asset', assetClass: 'asset', category: 'liquid',
      subKind: 'bank_account', currencyCode: 'TWD', pricingMode: 'fixed',
    })
    const res = await app.request('/api/v1/backup/reset', {
      method: 'DELETE',
      headers: { 'x-user-id': userA.id },
    })
    expect(res.status).toBe(200)
    const remaining = await testDb.select().from(assets)
    expect(remaining).toHaveLength(1)
    expect(remaining[0].name).toBe('B-Asset')
  })
})
