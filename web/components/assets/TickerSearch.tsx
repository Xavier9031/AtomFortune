'use client'
import { useState, useEffect, useRef } from 'react'
import { BASE } from '@/lib/api'
import { fetchWithUser } from '@/lib/user'
import type { Ticker } from '@/lib/types'

interface Props {
  onSelect: (t: Ticker) => void
  onBack: () => void
  defaultMarket?: Market
}

type Market = 'TW' | 'US' | 'Crypto'

export function TickerSearch({ onSelect, onBack, defaultMarket = 'TW' }: Props) {
  const [market, setMarket] = useState<Market>(defaultMarket)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Ticker[]>([])
  const [loading, setLoading] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    if (query.length < 1) { setResults([]); return }
    timerRef.current = setTimeout(async () => {
      setLoading(true)
      try {
        const url = `${BASE}/tickers/search?q=${encodeURIComponent(query)}&country=${market}`
        const res = await fetchWithUser(url)
        setResults(res.ok ? await res.json() : [])
      } finally {
        setLoading(false)
      }
    }, 300)
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [query, market])

  return (
    <div className="p-4 space-y-4">
      {/* Market toggle */}
      <div className="flex gap-1 p-0.5 bg-[var(--color-bg)] rounded-lg w-fit">
        {(['TW', 'US', 'Crypto'] as Market[]).map(m => (
          <button key={m} onClick={() => { setMarket(m); setQuery(''); setResults([]) }}
            className={`px-4 py-1.5 text-sm rounded-md transition-colors
              ${market === m
                ? 'bg-[var(--color-surface)] shadow-sm font-semibold'
                : 'text-[var(--color-muted)] hover:text-[var(--color-text)]'}`}>
            {m === 'TW' ? '台股' : m === 'US' ? '美股' : '加密貨幣'}
          </button>
        ))}
      </div>

      {/* Search input */}
      <div className="relative">
        <input
          autoFocus
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder={market === 'TW' ? '搜尋代號或名稱（例：2330、台積電）' : market === 'US' ? 'Search symbol or name (e.g. AAPL, Apple)' : 'Search coin name (e.g. Bitcoin, ETH)'}
          className="w-full px-4 py-3 rounded-xl border border-[var(--color-border)]
            bg-[var(--color-bg)] text-sm outline-none focus:border-[var(--color-accent)]"
        />
        {loading && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[var(--color-muted)]">搜尋中…</span>
        )}
      </div>

      {/* Results */}
      {results.length > 0 && (
        <div className="rounded-xl border border-[var(--color-border)] overflow-hidden">
          {results.map((t, i) => (
            <button key={t.symbol} onClick={() => onSelect(t)}
              className={`w-full flex items-center gap-3 px-4 py-3 text-left
                hover:bg-[var(--color-bg)] transition-colors
                ${i < results.length - 1 ? 'border-b border-[var(--color-border)]' : ''}`}>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{t.name}</div>
                <div className="text-xs text-[var(--color-muted)] mt-0.5">
                  {t.symbol} · {t.exchange}
                </div>
              </div>
              <span className={`shrink-0 text-xs px-2 py-0.5 rounded-full font-medium
                ${t.type === 'etf'
                  ? 'bg-indigo-100 text-indigo-700'
                  : t.type === 'crypto'
                  ? 'bg-orange-100 text-orange-700'
                  : 'bg-green-100 text-green-700'}`}>
                {t.type === 'etf' ? 'ETF' : t.type === 'crypto' ? '加密貨幣' : '股票'}
              </span>
            </button>
          ))}
        </div>
      )}

      {query.length >= 1 && !loading && results.length === 0 && (
        <p className="text-sm text-[var(--color-muted)] text-center py-4">找不到符合的結果</p>
      )}
    </div>
  )
}
