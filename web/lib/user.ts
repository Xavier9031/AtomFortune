const UID_KEY = 'atomfortune_uid'
const DEFAULT_USER_ID = 'default-user'

/**
 * Returns the active user ID from localStorage.
 * Falls back to 'default-user' if not set.
 */
export function getActiveUserId(): string {
  if (typeof window === 'undefined') return DEFAULT_USER_ID
  return localStorage.getItem(UID_KEY) ?? DEFAULT_USER_ID
}

export function setActiveUserId(id: string): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(UID_KEY, id)
}

/**
 * Ensures an active user ID is set. Returns the active ID.
 */
export function ensureActiveUserId(): string {
  const current = getActiveUserId()
  if (typeof window !== 'undefined' && !localStorage.getItem(UID_KEY)) {
    setActiveUserId(current)
  }
  return current
}

/**
 * Wrapper around fetch() that automatically injects X-User-Id header.
 * Use this everywhere a component calls fetch() directly.
 */
export function fetchWithUser(input: string, init?: RequestInit): Promise<Response> {
  const userId = getActiveUserId()
  const headers = new Headers(init?.headers)
  headers.set('x-user-id', userId)
  return fetch(input, { ...init, headers })
}
