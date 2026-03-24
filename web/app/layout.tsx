import './globals.css'
import type { Metadata } from 'next'
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

  return (
    <html lang={locale}>
      <head>
        {/* Apply lang-enter animation before first paint, avoiding a flash */}
        <script dangerouslySetInnerHTML={{ __html: `(function(){if(localStorage.getItem('lang-anim')){document.documentElement.classList.add('lang-enter');localStorage.removeItem('lang-anim');setTimeout(function(){document.documentElement.classList.remove('lang-enter')},500);}})();` }} />
      </head>
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
