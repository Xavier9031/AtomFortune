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

  it('GET /api/v1/system/config returns runtime config', async () => {
    const res = await app.request('/api/v1/system/config')
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.snapshotSchedule).toBeTypeOf('string')
  })

  it('allows CORS for trusted localhost origins', async () => {
    const res = await app.request('/health', {
      method: 'OPTIONS',
      headers: {
        Origin: 'http://localhost:3000',
        'Access-Control-Request-Method': 'GET',
        'Access-Control-Request-Headers': 'x-user-id,x-backup-password',
      },
    })
    expect(res.status).toBe(204)
    expect(res.headers.get('access-control-allow-origin')).toBe('http://localhost:3000')
    expect(res.headers.get('access-control-allow-headers')?.toLowerCase()).toContain('x-user-id')
    expect(res.headers.get('access-control-allow-headers')?.toLowerCase()).toContain('authorization')
  })

  it('does not grant CORS to untrusted origins', async () => {
    const res = await app.request('/health', {
      method: 'OPTIONS',
      headers: {
        Origin: 'https://evil.example',
        'Access-Control-Request-Method': 'GET',
        'Access-Control-Request-Headers': 'x-user-id',
      },
    })
    expect(res.status).toBe(204)
    expect(res.headers.get('access-control-allow-origin')).toBeNull()
  })
})
