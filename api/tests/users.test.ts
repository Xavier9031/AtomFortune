import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import app from '../src/index'
import { cleanDb, closeDb, testDb, seedTestUser } from './helpers/db'
import { users } from '../src/db/schema'

beforeEach(() => cleanDb())
afterAll(() => closeDb())

describe('GET /api/v1/users', () => {
  it('returns empty array when no users', async () => {
    const res = await app.request('/api/v1/users')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual([])
  })

  it('returns list of users after creation', async () => {
    await testDb.insert(users).values({ id: 'u1', name: 'Alice' })
    await testDb.insert(users).values({ id: 'u2', name: 'Bob' })
    const res = await app.request('/api/v1/users')
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toHaveLength(2)
    expect(body.map((u: any) => u.name).sort()).toEqual(['Alice', 'Bob'])
  })
})

describe('POST /api/v1/users', () => {
  it('creates a user and returns 201', async () => {
    const res = await app.request('/api/v1/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Carol' }),
    })
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.id).toBeDefined()
    expect(body.name).toBe('Carol')
  })

  it('returns 400 if name is missing', async () => {
    const res = await app.request('/api/v1/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    expect(res.status).toBe(400)
  })
})

describe('PUT /api/v1/users/:id', () => {
  it('updates user name and returns 200', async () => {
    const [u] = await testDb.insert(users).values({ id: 'u1', name: 'Old' }).returning()
    const res = await app.request(`/api/v1/users/${u.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'New Name' }),
    })
    expect(res.status).toBe(200)
    expect((await res.json()).name).toBe('New Name')
  })

  it('returns 404 for unknown user', async () => {
    const res = await app.request('/api/v1/users/nonexistent', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'X' }),
    })
    expect(res.status).toBe(404)
  })
})

describe('DELETE /api/v1/users/:id', () => {
  it('deletes user and returns 204', async () => {
    const [u] = await testDb.insert(users).values({ id: 'u1', name: 'ToDelete' }).returning()
    const res = await app.request(`/api/v1/users/${u.id}`, { method: 'DELETE' })
    expect(res.status).toBe(204)
    const remaining = await testDb.select().from(users)
    expect(remaining).toHaveLength(0)
  })

  it('returns 404 for unknown user', async () => {
    const res = await app.request('/api/v1/users/ghost', { method: 'DELETE' })
    expect(res.status).toBe(404)
  })
})
