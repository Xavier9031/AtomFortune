import { NextRequest } from 'next/server'

const API_ORIGIN = process.env.API_ORIGIN ?? 'http://localhost:8000'

async function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl
  const url = `${API_ORIGIN}${pathname}${search}`

  const headers = new Headers(req.headers)
  headers.delete('host')
  if (process.env.API_TOKEN && !headers.has('authorization') && !headers.has('x-api-token')) {
    headers.set('authorization', `Bearer ${process.env.API_TOKEN}`)
  }

  const init: RequestInit = { method: req.method, headers }

  if (req.body) {
    init.body = req.body
    // @ts-expect-error duplex required for streaming request body
    init.duplex = 'half'
  }

  const res = await fetch(url, init)

  return new Response(res.body, {
    status: res.status,
    statusText: res.statusText,
    headers: res.headers,
  })
}

export const GET = proxy
export const POST = proxy
export const PUT = proxy
export const PATCH = proxy
export const DELETE = proxy
