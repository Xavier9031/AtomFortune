'use client'
import { useState, useRef, useEffect } from 'react'
import { flushSync } from 'react-dom'
import { useTranslations, useLocale } from 'next-intl'

const CURRENCY_CODES = [
  'TWD', 'USD', 'JPY', 'EUR', 'GBP', 'CNY', 'HKD',
  'SGD', 'AUD', 'CAD', 'CHF', 'KRW', 'MYR', 'THB',
  'VND', 'IDR', 'PHP',
]

interface Props {
  value: string
  onChange: (code: string) => void
}

export function CurrencyPicker({ value, onChange }: Props) {
  const t = useTranslations('common')
  const locale = useLocale()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [pos, setPos] = useState({ top: 0, right: 0 })
  const btnRef = useRef<HTMLButtonElement>(null)
  const dropRef = useRef<HTMLDivElement>(null)

  const displayNames = new Intl.DisplayNames([locale], { type: 'currency' })

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (
        dropRef.current && !dropRef.current.contains(e.target as Node) &&
        btnRef.current && !btnRef.current.contains(e.target as Node)
      ) {
        setOpen(false)
        setQuery('')
      }
    }
    if (open) document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [open])

  function handleToggle() {
    if (!open && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect()
      setPos({ top: rect.bottom + 6, right: window.innerWidth - rect.right })
    }
    setOpen(p => !p)
    setQuery('')
  }

  const q = query.toUpperCase()
  const filtered = CURRENCY_CODES.filter(code => {
    if (code.includes(q)) return true
    const name = displayNames.of(code) ?? ''
    return name.toLowerCase().includes(query.toLowerCase())
  })

  return (
    <div className="shrink-0">
      <button
        ref={btnRef}
        type="button"
        onClick={handleToggle}
        className="h-7 px-2.5 flex items-center gap-1 rounded-lg text-xs font-medium
          bg-[var(--color-bg)] border border-[var(--color-border)]
          hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] transition-colors">
        {value}
        <span className="text-[0.6rem] opacity-50">▾</span>
      </button>

      {open && (
        <div
          ref={dropRef}
          style={{ top: pos.top, right: pos.right }}
          className="fixed w-52 bg-[var(--color-surface)] border
            border-[var(--color-border)] rounded-xl shadow-xl z-[200] overflow-hidden">
          <div className="p-2 border-b border-[var(--color-border)]">
            <input
              autoFocus
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder={t('search') + '…'}
              className="w-full px-2 py-1.5 text-xs rounded-lg border border-[var(--color-border)]
                bg-[var(--color-bg)] outline-none focus:border-[var(--color-accent)]"
            />
          </div>
          <div className="max-h-52 overflow-y-auto">
            {filtered.length === 0
              ? <p className="text-xs text-[var(--color-muted)] text-center py-3">{t('notFound')}</p>
              : filtered.map(code => (
                <button
                  key={code}
                  type="button"
                  onClick={() => {
                    setOpen(false)
                    setQuery('')
                    if (!document.startViewTransition) { onChange(code); return }
                    document.startViewTransition(() => { flushSync(() => onChange(code)) })
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2 text-xs
                    hover:bg-[var(--color-bg)] transition-colors
                    ${code === value ? 'font-bold text-[var(--color-accent)]' : ''}`}>
                  <span className="font-mono font-bold">{code}</span>
                  <span className="text-[var(--color-muted)] truncate ml-2 text-right">
                    {displayNames.of(code)}
                  </span>
                </button>
              ))
            }
          </div>
        </div>
      )}
    </div>
  )
}
