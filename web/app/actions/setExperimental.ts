'use server'
import { cookies } from 'next/headers'

export async function setExperimental(enabled: boolean) {
  const cookieStore = await cookies()
  cookieStore.set('experimental', enabled ? 'true' : 'false', { path: '/', maxAge: 60 * 60 * 24 * 365 })
}
