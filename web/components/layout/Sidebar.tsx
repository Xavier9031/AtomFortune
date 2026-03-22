'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Wallet, Briefcase, Building2, Camera, Settings } from 'lucide-react'

const NAV = [
  { href: '/',          label: 'Dashboard',  Icon: LayoutDashboard },
  { href: '/holdings',  label: 'Holdings',   Icon: Wallet },
  { href: '/assets',    label: 'Assets',     Icon: Briefcase },
  { href: '/accounts',  label: 'Accounts',   Icon: Building2 },
  { href: '/snapshots', label: 'Snapshots',  Icon: Camera },
  { href: '/settings',  label: 'Settings',   Icon: Settings },
]

export default function Sidebar() {
  const path = usePathname()
  return (
    <nav className="w-56 min-h-screen bg-surface border-r border-border flex flex-col pt-6 gap-1">
      {NAV.map(({ href, label, Icon }) => (
        <Link
          key={href}
          href={href}
          className={`flex items-center gap-3 px-5 py-2.5 text-sm rounded-lg mx-2 transition-colors
            ${path === href ? 'bg-accent text-white' : 'text-[var(--color-text)] hover:bg-bg'}`}
        >
          <Icon size={16} />{label}
        </Link>
      ))}
    </nav>
  )
}
