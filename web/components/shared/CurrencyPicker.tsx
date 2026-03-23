'use client'
import { useState, useRef, useEffect } from 'react'

const CURRENCIES = [
  { code: 'TWD', name: '新台幣' },
  { code: 'USD', name: '美元' },
  { code: 'JPY', name: '日圓' },
  { code: 'EUR', name: '歐元' },
  { code: 'GBP', name: '英鎊' },
  { code: 'CNY', name: '人民幣' },
  { code: 'HKD', name: '港幣' },
  { code: 'SGD', name: '新加坡元' },
  { code: 'AUD', name: '澳幣' },
  { code: 'CAD', name: '加拿大元' },
  { code: 'CHF', name: '瑞士法郎' },
  { code: 'KRW', name: '韓元' },
  { code: 'MYR', name: '馬來西亞令吉' },
  { code: 'THB', name: '泰銖' },
  { code: 'VND', name: '越南盾' },
  { code: 'IDR', name: '印尼盾' },
  { code: 'PHP', name: '菲律賓披索' },
]

interface Props {
  value: string
  onChange: (code: string) => void
}

export function CurrencyPicker({ value, onChange }: Props) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
        setQuery('')
      }
    }
    if (open) document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [open])

  const filtered = CURRENCIES.filter(c =>
    c.code.includes(query.toUpperCase()) || c.name.includes(query)
  )

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        onClick={() => { setOpen(p => !p); setQuery('') }}
        className="px-2 py-1 bg-[var(--color-text)] text-[var(--color-surface)]
          rounded-full text-xs font-bold flex items-center gap-1 hover:opacity-80 transition-opacity">
        {value}
        <span className="text-[0.6rem] opacity-60">▾</span>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-52 bg-[var(--color-surface)] border
          border-[var(--color-border)] rounded-xl shadow-xl z-50 overflow-hidden">
          <div className="p-2 border-b border-[var(--color-border)]">
            <input
              autoFocus
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="搜尋（TWD、日圓…）"
              className="w-full px-2 py-1.5 text-xs rounded-lg border border-[var(--color-border)]
                bg-[var(--color-bg)] outline-none focus:border-[var(--color-accent)]"
            />
          </div>
          <div className="max-h-52 overflow-y-auto">
            {filtered.length === 0
              ? <p className="text-xs text-[var(--color-muted)] text-center py-3">找不到</p>
              : filtered.map(c => (
                <button
                  key={c.code}
                  type="button"
                  onClick={() => { onChange(c.code); setOpen(false); setQuery('') }}
                  className={`w-full flex items-center justify-between px-3 py-2 text-xs
                    hover:bg-[var(--color-bg)] transition-colors
                    ${c.code === value ? 'font-bold text-[var(--color-accent)]' : ''}`}>
                  <span className="font-mono font-bold">{c.code}</span>
                  <span className="text-[var(--color-muted)]">{c.name}</span>
                </button>
              ))
            }
          </div>
        </div>
      )}
    </div>
  )
}
