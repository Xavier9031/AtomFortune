'use client'
import { useState, useEffect, useRef, useTransition } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { Moon, Sun } from 'lucide-react'
import { useCurrency } from '@/context/CurrencyContext'
import { CurrencyPicker } from '@/components/shared/CurrencyPicker'
import { setLocale } from '@/app/actions/setLocale'
import { setTheme } from '@/app/actions/setTheme'
import { SUPPORTED_LOCALES } from '@/lib/locales'
import type { Currency } from '@/lib/types'

const LOCALE_LABEL: Record<string, string> = { 'zh-TW': '中文', 'en': 'EN' }

function LocaleSwitcher() {
  const t = useTranslations('settings')
  const locale = useLocale()
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const wasPending = useRef(false)
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ top: 0, right: 0 })
  const btnRef = useRef<HTMLButtonElement>(null)
  const dropRef = useRef<HTMLDivElement>(null)

  // Fade back in once router.refresh() completes
  useEffect(() => {
    if (wasPending.current && !isPending) {
      wasPending.current = false
      const html = document.documentElement
      html.style.transition = 'opacity 0.25s ease'
      html.style.opacity = '1'
      setTimeout(() => { html.style.transition = ''; html.style.opacity = '' }, 300)
    }
  }, [isPending])

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (
        dropRef.current && !dropRef.current.contains(e.target as Node) &&
        btnRef.current && !btnRef.current.contains(e.target as Node)
      ) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [open])

  function handleOpen() {
    if (!open && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect()
      setPos({ top: rect.bottom + 6, right: window.innerWidth - rect.right })
    }
    setOpen(p => !p)
  }

  async function handleSelect(l: string) {
    setOpen(false)
    // Fade out
    const html = document.documentElement
    html.style.transition = 'opacity 0.2s ease'
    html.style.opacity = '0'
    await new Promise(r => setTimeout(r, 220))
    await setLocale(l)
    wasPending.current = true
    startTransition(() => router.refresh())
  }

  return (
    <div className="shrink-0">
      <button
        ref={btnRef}
        onClick={handleOpen}
        disabled={isPending}
        className="h-7 px-2.5 flex items-center gap-1 rounded-lg text-xs font-medium
          bg-[var(--color-bg)] border border-[var(--color-border)]
          hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] transition-colors
          disabled:opacity-50">
        {LOCALE_LABEL[locale] ?? locale}
        <span className="text-[0.6rem] opacity-50">▾</span>
      </button>

      {open && (
        <div
          ref={dropRef}
          style={{ top: pos.top, right: pos.right }}
          className="fixed bg-[var(--color-surface)] border border-[var(--color-border)]
            rounded-xl shadow-xl z-[200] overflow-hidden min-w-[8rem]">
          {SUPPORTED_LOCALES.map(l => (
            <button
              key={l}
              onClick={() => handleSelect(l)}
              className={`w-full flex items-center justify-between px-3 py-2.5 text-xs
                hover:bg-[var(--color-bg)] transition-colors
                ${l === locale ? 'font-bold text-[var(--color-accent)]' : ''}`}>
              <span className="font-medium">{LOCALE_LABEL[l] ?? l}</span>
              <span className="text-[var(--color-muted)] ml-3">
                {t(`languages.${l}` as Parameters<typeof t>[0])}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default function TopBar() {
  const { currency, setCurrency } = useCurrency()
  const [dark, setDark] = useState(false)

  useEffect(() => {
    setDark(document.documentElement.dataset.theme === 'dark')
  }, [])

  async function toggleTheme() {
    const next = !dark
    setDark(next)
    const html = document.documentElement
    html.classList.add('theme-changing')
    html.dataset.theme = next ? 'dark' : 'light'
    await setTheme(next ? 'dark' : 'light')
    setTimeout(() => html.classList.remove('theme-changing'), 350)
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

      <div className="flex items-center gap-1.5">
        <CurrencyPicker value={currency} onChange={v => setCurrency(v as Currency)} />
        <LocaleSwitcher />
        <button
          aria-label="theme toggle"
          onClick={toggleTheme}
          className="h-7 w-7 flex items-center justify-center rounded-lg
            bg-[var(--color-bg)] border border-[var(--color-border)]
            hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] transition-colors">
          {dark ? <Sun size={14} /> : <Moon size={14} />}
        </button>
      </div>
    </header>
  )
}
