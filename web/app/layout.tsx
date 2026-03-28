import './globals.css'
import type { Metadata, Viewport } from 'next'
import { cookies } from 'next/headers'
import { NextIntlClientProvider } from 'next-intl'
import { getLocale, getMessages } from 'next-intl/server'
import { CurrencyProvider } from '@/context/CurrencyContext'
import Sidebar from '@/components/layout/Sidebar'
import TopBar from '@/components/layout/TopBar'
import BottomNav from '@/components/layout/BottomNav'
import ClientInit from '@/components/ClientInit'
import OnboardingScreen from '@/components/layout/OnboardingScreen'

export const metadata: Metadata = {
  title: 'AtomFortune',
  description: 'Local-first personal net worth tracker.',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
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
        <ClientInit />
        <NextIntlClientProvider locale={locale} messages={messages}>
          <CurrencyProvider>
            <OnboardingScreen />
            <TopBar />
            <div className="flex">
              <div className="shrink-0"><Sidebar /></div>
              <main className="flex-1 min-w-0 p-4 md:p-6 pb-20 md:pb-6 bg-bg min-h-screen overflow-x-hidden">{children}</main>
            </div>
            <BottomNav />
          </CurrencyProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
