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
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 720 160" className="h-7 w-auto" aria-label="Atom Fortune">
        <g transform="translate(174,80)" fill="none" stroke="#2A8B8B" strokeWidth="2.2">
          <ellipse rx="38" ry="18" transform="rotate(0)"/>
          <ellipse rx="38" ry="18" transform="rotate(60)"/>
          <ellipse rx="38" ry="18" transform="rotate(-60)"/>
        </g>
        <circle cx="174" cy="80" r="22" fill="#2A8B8B"/>
        <g transform="translate(174,80)">
          <rect x="-11" y="3" width="5" height="5" fill="#C8EAEA" rx="1"/>
          <rect x="-4" y="-1" width="5" height="9" fill="#A8D8D8" rx="1"/>
          <rect x="3" y="-6" width="5" height="14" fill="#7ECECE" rx="1"/>
          <polyline points="-9,2 -1,-4 7,-9" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <polyline points="3,-11 7,-9 5,-5" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </g>
        <text x="14" y="110" fontFamily="Georgia,'Times New Roman',serif" fontWeight="700" fontSize="92" fill="currentColor" letterSpacing="-2">At</text>
        <text x="210" y="110" fontFamily="Georgia,'Times New Roman',serif" fontWeight="700" fontSize="92" fill="currentColor" letterSpacing="-2">m Fortune</text>
      </svg>
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
