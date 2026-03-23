'use client'
import { useCurrency } from '@/context/CurrencyContext'
import { Moon, Sun } from 'lucide-react'
import { useState, useEffect } from 'react'
import type { Currency } from '@/lib/types'

export default function TopBar() {
  const { currency, setCurrency } = useCurrency()
  const [dark, setDark] = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem('theme')
    if (stored === 'dark') {
      setDark(true)
      document.documentElement.dataset.theme = 'dark'
    }
  }, [])

  const toggleTheme = () => {
    const next = !dark
    setDark(next)
    document.documentElement.dataset.theme = next ? 'dark' : 'light'
    localStorage.setItem('theme', next ? 'dark' : 'light')
  }

  return (
    <header className="h-14 flex items-center justify-between px-6 border-b border-border bg-surface">
      <img src="/atomworth-logo.svg" alt="AtomWorth" className="h-7 w-auto" />
      <div className="flex items-center gap-3">
        <select
          aria-label="currency"
          className="bg-bg border border-border rounded px-2 py-1 text-sm"
          value={currency}
          onChange={e => setCurrency(e.target.value as Currency)}
        >
          {(['TWD', 'USD', 'JPY'] as Currency[]).map(c => <option key={c}>{c}</option>)}
        </select>
        <button aria-label="theme toggle" onClick={toggleTheme} className="p-1 rounded hover:bg-bg">
          {dark ? <Sun size={16} /> : <Moon size={16} />}
        </button>
      </div>
    </header>
  )
}
