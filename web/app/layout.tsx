import './globals.css'
import { CurrencyProvider } from '@/context/CurrencyContext'
import Sidebar from '@/components/layout/Sidebar'
import TopBar from '@/components/layout/TopBar'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <CurrencyProvider>
          <TopBar />
          <div className="flex">
            <Sidebar />
            <main className="flex-1 p-6 bg-bg min-h-screen">{children}</main>
          </div>
        </CurrencyProvider>
      </body>
    </html>
  )
}
