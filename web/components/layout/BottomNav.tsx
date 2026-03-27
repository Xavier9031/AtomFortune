'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { LayoutDashboard, Wallet, Briefcase, Building2, Camera, Settings, FlaskConical } from 'lucide-react'

const NAV_ITEMS = [
  { href: '/',          key: 'nav.dashboard',  Icon: LayoutDashboard },
  { href: '/holdings',  key: 'nav.holdings',   Icon: Wallet },
  { href: '/assets',    key: 'nav.assets',     Icon: Briefcase },
  { href: '/accounts',  key: 'nav.accounts',   Icon: Building2 },
  { href: '/snapshots', key: 'nav.snapshots',  Icon: Camera },
] as const

export default function BottomNav() {
  const path = usePathname()
  const t = useTranslations()
  const [experimental, setExperimental] = useState(false)

  useEffect(() => {
    const check = () => setExperimental(document.documentElement.dataset.experimental === 'true')
    check()
    const observer = new MutationObserver(check)
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-experimental'] })
    return () => observer.disconnect()
  }, [])

  const items = [
    ...NAV_ITEMS,
    ...(experimental ? [{ href: '/experimental', key: 'nav.experimental', Icon: FlaskConical }] : []),
    { href: '/settings', key: 'nav.settings', Icon: Settings },
  ]

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-20 bg-surface border-t border-border
      flex items-center justify-around h-14 px-1 safe-bottom">
      {items.map(({ href, key, Icon }) => {
        const active = href === '/' ? path === '/' : path.startsWith(href)
        return (
          <Link key={href} href={href}
            className={`flex flex-col items-center justify-center gap-0.5 flex-1 py-1.5 rounded-lg transition-colors
              ${active ? 'text-accent' : 'text-muted'}`}>
            <Icon size={18} strokeWidth={active ? 2.2 : 1.8} />
            <span className="text-[10px] leading-tight font-medium">{t(key as Parameters<typeof t>[0])}</span>
          </Link>
        )
      })}
    </nav>
  )
}
