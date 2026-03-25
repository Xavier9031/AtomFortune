'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useState, useEffect } from 'react'
import { LayoutDashboard, Wallet, Briefcase, Building2, Camera, Settings, FlaskConical } from 'lucide-react'
import UserSwitcher from './UserSwitcher'

const NAV_ITEMS = [
  { href: '/',          key: 'nav.dashboard',  Icon: LayoutDashboard },
  { href: '/holdings',  key: 'nav.holdings',   Icon: Wallet },
  { href: '/assets',    key: 'nav.assets',     Icon: Briefcase },
  { href: '/accounts',  key: 'nav.accounts',   Icon: Building2 },
  { href: '/snapshots', key: 'nav.snapshots',  Icon: Camera },
] as const

export default function Sidebar() {
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

  const linkClass = (href: string) =>
    `flex items-center gap-3 px-5 py-2.5 text-sm rounded-lg mx-2 transition-colors
    ${path === href ? 'bg-accent text-white' : 'text-[var(--color-text)] hover:bg-bg'}`

  return (
    <nav className="w-56 sticky top-14 h-[calc(100vh-3.5rem)] overflow-y-auto bg-surface border-r border-border flex flex-col pt-6 gap-1">
      {NAV_ITEMS.map(({ href, key, Icon }) => (
        <Link key={href} href={href} className={linkClass(href)}>
          <Icon size={16} />{t(key)}
        </Link>
      ))}
      {experimental && (
        <Link href="/experimental" className={linkClass('/experimental')}>
          <FlaskConical size={16} />{t('nav.experimental')}
        </Link>
      )}
      <Link href="/settings" className={linkClass('/settings')}>
        <Settings size={16} />{t('nav.settings')}
      </Link>
      <div className="flex-1" />
      <UserSwitcher />
    </nav>
  )
}
