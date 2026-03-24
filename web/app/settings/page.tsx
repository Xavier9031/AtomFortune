'use client'
import { useState, useEffect, useRef, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { setLocale } from '@/app/actions/setLocale'
import { setTheme } from '@/app/actions/setTheme'
import { SUPPORTED_LOCALES } from '@/lib/locales'
import { BASE } from '@/lib/api'

export default function SettingsPage() {
  const t = useTranslations()
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const wasPending = useRef(false)
  const resolveRef = useRef<(() => void) | null>(null)
  const [dark, setDark] = useState(false)
  const [importMsg, setImportMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [importing, setImporting] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const schedule = process.env.NEXT_PUBLIC_SNAPSHOT_SCHEDULE ?? '0 22 * * *'

  useEffect(() => {
    setDark(document.documentElement.dataset.theme === 'dark')
  }, [])

  // Resolve the View Transition promise once router.refresh() has committed
  useEffect(() => {
    if (wasPending.current && !isPending) {
      wasPending.current = false
      resolveRef.current?.()
      resolveRef.current = null
    }
  }, [isPending])

  async function handleDark(checked: boolean) {
    setDark(checked)
    const html = document.documentElement
    html.classList.add('theme-changing')
    html.dataset.theme = checked ? 'dark' : 'light'
    await setTheme(checked ? 'dark' : 'light')
    setTimeout(() => html.classList.remove('theme-changing'), 350)
  }

  function handleExport() {
    window.open(`${BASE}/backup/export`, '_blank')
  }

  async function handleImport(file: File) {
    setImporting(true)
    setImportMsg(null)
    try {
      const form = new FormData()
      form.append('file', file)
      const res = await fetch(`${BASE}/backup/import`, { method: 'POST', body: form })
      const json = await res.json()
      if (!res.ok) {
        setImportMsg({ ok: false, text: `${t('settings.importError')}: ${json.error}` })
      } else {
        const c = json.imported
        setImportMsg({ ok: true, text: t('settings.importSuccess', {
          assets: c.assets, accounts: c.accounts, holdings: c.holdings,
          transactions: c.transactions, snapshotItems: c.snapshotItems,
        }) })
      }
    } catch (err) {
      setImportMsg({ ok: false, text: `${t('settings.importError')}: ${err instanceof Error ? err.message : String(err)}` })
    } finally {
      setImporting(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  async function handleLocale(locale: string) {
    if (!document.startViewTransition) {
      await setLocale(locale)
      wasPending.current = true
      startTransition(() => router.refresh())
      return
    }
    document.startViewTransition(() => new Promise<void>((resolve) => {
      resolveRef.current = resolve
      wasPending.current = true
      setLocale(locale).then(() => startTransition(() => router.refresh()))
    }))
  }

  return (
    <main className="p-6 max-w-lg mx-auto space-y-8">
      <h1 className="text-xl font-bold">{t('settings.title')}</h1>

      <section className="flex items-center gap-3">
        <label htmlFor="darkMode" className="text-sm font-medium">{t('settings.darkMode')}</label>
        <input id="darkMode" type="checkbox" checked={dark} onChange={e => handleDark(e.target.checked)} />
      </section>

      <section className="space-y-2">
        <p className="text-sm font-medium">{t('settings.language')}</p>
        <div className="flex gap-2">
          {SUPPORTED_LOCALES.map(locale => (
            <button key={locale} onClick={() => handleLocale(locale)}
              className="px-4 py-2 rounded-lg text-sm border transition-colors"
              style={{
                background: 'var(--color-surface)',
                borderColor: 'var(--color-border)',
              }}>
              {t(`settings.languages.${locale}`)}
            </button>
          ))}
        </div>
      </section>

      <section className="space-y-1">
        <p className="text-sm font-medium text-[var(--color-muted)]">{t('settings.snapshotSchedule')}</p>
        <code className="text-sm bg-[var(--color-bg)] px-3 py-1 rounded border">{schedule}</code>
        <p className="text-xs text-[var(--color-muted)]">{t('settings.snapshotScheduleDesc')}</p>
      </section>

      <section className="space-y-3">
        <div>
          <p className="text-sm font-medium">{t('settings.backup')}</p>
          <p className="text-xs text-[var(--color-muted)] mt-1">{t('settings.backupDesc')}</p>
        </div>
        <div className="flex gap-3">
          <button onClick={handleExport}
            className="px-4 py-2 rounded-lg text-sm border transition-colors"
            style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
            {t('settings.exportButton')}
          </button>
          <button onClick={() => fileRef.current?.click()} disabled={importing}
            className="px-4 py-2 rounded-lg text-sm border transition-colors disabled:opacity-50"
            style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
            {importing ? t('settings.importing') : t('settings.importButton')}
          </button>
          <input ref={fileRef} type="file" accept=".zip" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleImport(f) }} />
        </div>
        {importMsg && (
          <p className={`text-xs ${importMsg.ok ? 'text-green-500' : 'text-red-400'}`}>
            {importMsg.text}
          </p>
        )}
      </section>
    </main>
  )
}
