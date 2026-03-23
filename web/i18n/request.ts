import { getRequestConfig } from 'next-intl/server'
import { cookies } from 'next/headers'
import { SUPPORTED_LOCALES, DEFAULT_LOCALE } from '@/lib/locales'
export type { Locale } from '@/lib/locales'

export default getRequestConfig(async () => {
  const cookieStore = await cookies()
  const raw = cookieStore.get('NEXT_LOCALE')?.value
  const locale = SUPPORTED_LOCALES.includes(raw as typeof SUPPORTED_LOCALES[number]) ? raw as typeof SUPPORTED_LOCALES[number] : DEFAULT_LOCALE
  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  }
})
