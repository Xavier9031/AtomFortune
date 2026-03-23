import { getRequestConfig } from 'next-intl/server'
import { cookies } from 'next/headers'

const SUPPORTED_LOCALES = ['zh-TW', 'en'] as const
export type Locale = typeof SUPPORTED_LOCALES[number]
export const DEFAULT_LOCALE: Locale = 'zh-TW'

export default getRequestConfig(async () => {
  const cookieStore = await cookies()
  const raw = cookieStore.get('NEXT_LOCALE')?.value
  const locale: Locale = SUPPORTED_LOCALES.includes(raw as Locale) ? (raw as Locale) : DEFAULT_LOCALE
  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  }
})
