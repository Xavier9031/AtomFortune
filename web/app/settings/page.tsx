'use client'
import { useState, useEffect } from 'react'

const CURRENCIES = ['TWD', 'USD', 'JPY']

export default function SettingsPage() {
  const [currency, setCurrency] = useState('TWD')
  const [dark, setDark] = useState(false)
  const schedule = process.env.NEXT_PUBLIC_SNAPSHOT_SCHEDULE ?? '0 22 * * *'

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setCurrency(localStorage.getItem('displayCurrency') ?? 'TWD')
      setDark(document.documentElement.getAttribute('data-theme') === 'dark')
    }
  }, [])

  function handleCurrency(v: string) {
    setCurrency(v)
    if (typeof window !== 'undefined') localStorage.setItem('displayCurrency', v)
  }

  function handleDark(checked: boolean) {
    setDark(checked)
    if (typeof window !== 'undefined') {
      document.documentElement.setAttribute('data-theme', checked ? 'dark' : 'light')
      localStorage.setItem('theme', checked ? 'dark' : 'light')
    }
  }

  return (
    <main className="p-6 max-w-lg mx-auto space-y-8">
      <h1 className="text-xl font-bold">設定</h1>

      <section className="space-y-2">
        <label htmlFor="currency" className="block text-sm font-medium">顯示幣別</label>
        <select id="currency" value={currency} onChange={e => handleCurrency(e.target.value)}
          className="border rounded px-3 py-2 w-40">
          {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </section>

      <section className="flex items-center gap-3">
        <label htmlFor="darkMode" className="text-sm font-medium">深色模式</label>
        <input id="darkMode" type="checkbox" checked={dark} onChange={e => handleDark(e.target.checked)} />
      </section>

      <section className="space-y-1">
        <p className="text-sm font-medium text-[var(--color-muted)]">快照排程（唯讀）</p>
        <code className="text-sm bg-[var(--color-bg)] px-3 py-1 rounded border">{schedule}</code>
        <p className="text-xs text-[var(--color-muted)]">由環境變數 SNAPSHOT_SCHEDULE 控制，需重啟服務才能變更。</p>
      </section>
    </main>
  )
}
