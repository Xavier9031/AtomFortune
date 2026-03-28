import { afterEach, describe, expect, it, vi } from 'vitest'

const originalApiToken = process.env.API_TOKEN

afterEach(() => {
  if (originalApiToken === undefined) delete process.env.API_TOKEN
  else process.env.API_TOKEN = originalApiToken
  vi.resetModules()
})

describe('API token auth', () => {
  it('requires a token when API_TOKEN is configured', async () => {
    process.env.API_TOKEN = 'secret-token'
    vi.resetModules()
    const { default: app } = await import('../src/index')

    const res = await app.request('/api/v1/system/config')
    expect(res.status).toBe(401)
  })

  it('accepts a bearer token when configured', async () => {
    process.env.API_TOKEN = 'secret-token'
    vi.resetModules()
    const { default: app } = await import('../src/index')

    const res = await app.request('/api/v1/system/config', {
      headers: { Authorization: 'Bearer secret-token' },
    })
    expect(res.status).toBe(200)
  })

  it('keeps health public even when API_TOKEN is configured', async () => {
    process.env.API_TOKEN = 'secret-token'
    vi.resetModules()
    const { default: app } = await import('../src/index')

    const res = await app.request('/health')
    expect(res.status).toBe(200)
  })
})
