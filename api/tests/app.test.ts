import { describe, it, expect } from 'vitest'
import app from '../src/index'

describe('Hono app', () => {
  it('GET /health returns 200', async () => {
    const res = await app.request('/health')
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.status).toBe('ok')
  })
  it('unknown route returns 404', async () => {
    const res = await app.request('/nonexistent')
    expect(res.status).toBe(404)
  })
})
