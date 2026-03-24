import './globals.css'
import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import { NextIntlClientProvider } from 'next-intl'
import { getLocale, getMessages } from 'next-intl/server'
import { CurrencyProvider } from '@/context/CurrencyContext'
import Sidebar from '@/components/layout/Sidebar'
import TopBar from '@/components/layout/TopBar'

export const metadata: Metadata = {
  title: 'Atom Fortune',
  description: '個人資產淨值追蹤系統',
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale()
  const messages = await getMessages()
  const cookieStore = await cookies()
  const theme = cookieStore.get('theme')?.value === 'dark' ? 'dark' : 'light'
  const experimental = cookieStore.get('experimental')?.value === 'true'

  return (
    <html lang={locale} data-theme={theme} data-experimental={experimental ? 'true' : undefined}>
      <body>
        <NextIntlClientProvider locale={locale} messages={messages}>
          <CurrencyProvider>
            <TopBar />
            <div className="flex">
              <Sidebar />
              <main className="flex-1 p-6 bg-bg min-h-screen">{children}</main>
            </div>
          </CurrencyProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
