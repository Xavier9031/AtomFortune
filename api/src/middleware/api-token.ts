import { timingSafeEqual } from 'crypto'
import type { Context, Next } from 'hono'

function secureEqual(expected: string, actual: string): boolean {
  const expectedBuf = Buffer.from(expected)
  const actualBuf = Buffer.from(actual)
  return expectedBuf.length === actualBuf.length && timingSafeEqual(expectedBuf, actualBuf)
}

function readToken(c: Context): string | null {
  const bearer = c.req.header('authorization')
  if (bearer?.startsWith('Bearer ')) return bearer.slice(7).trim()
  const headerToken = c.req.header('x-api-token')
  return headerToken?.trim() || null
}

export function apiTokenMiddleware(expectedToken: string | null) {
  return async (c: Context, next: Next) => {
    if (!expectedToken || c.req.method === 'OPTIONS') {
      await next()
      return
    }

    const actualToken = readToken(c)
    if (!actualToken || !secureEqual(expectedToken, actualToken)) {
      return c.json({ error: 'Unauthorized' }, 401)
    }

    await next()
  }
}
