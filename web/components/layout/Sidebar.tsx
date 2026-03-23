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

export default function Sidebar() {
  const path = usePathname()
  const t = useTranslations()
  return (
    <nav className="w-56 min-h-screen bg-surface border-r border-border flex flex-col pt-6 gap-1">
      {NAV_ITEMS.map(({ href, key, Icon }) => (
        <Link
          key={href}
          href={href}
          className={`flex items-center gap-3 px-5 py-2.5 text-sm rounded-lg mx-2 transition-colors
            ${path === href ? 'bg-accent text-white' : 'text-[var(--color-text)] hover:bg-bg'}`}
        >
          <Icon size={16} />{t(key)}
        </Link>
      ))}
    </nav>
  )
}
