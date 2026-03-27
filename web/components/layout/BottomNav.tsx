'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { LayoutDashboard, Wallet, Briefcase, Building2, Camera, Settings } from 'lucide-react'

const NAV_ITEMS = [
  { href: '/',          key: 'nav.dashboard',  Icon: LayoutDashboard },
  { href: '/holdings',  key: 'nav.holdings',   Icon: Wallet },
  { href: '/assets',    key: 'nav.assets',     Icon: Briefcase },
  { href: '/accounts',  key: 'nav.accounts',   Icon: Building2 },
  { href: '/snapshots', key: 'nav.snapshots',  Icon: Camera },
  { href: '/settings',  key: 'nav.settings',   Icon: Settings },
] as const

export default function BottomNav() {
  const path = usePathname()
  const t = useTranslations()

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-20 bg-surface border-t border-border
      flex items-center justify-around h-14 px-1 safe-bottom">
      {NAV_ITEMS.map(({ href, key, Icon }) => {
        const active = href === '/' ? path === '/' : path.startsWith(href)
        return (
          <Link key={href} href={href}
            className={`flex flex-col items-center justify-center gap-0.5 flex-1 py-1.5 rounded-lg transition-colors
              ${active ? 'text-accent' : 'text-muted'}`}>
            <Icon size={18} strokeWidth={active ? 2.2 : 1.8} />
            <span className="text-[10px] leading-tight font-medium">{t(key)}</span>
          </Link>
        )
      })}
    </nav>
  )
}
