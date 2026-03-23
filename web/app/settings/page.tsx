'use client'
import { useState, useEffect, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { setLocale } from '@/app/actions/setLocale'
import { SUPPORTED_LOCALES } from '@/lib/locales'

export default function SettingsPage() {
  const t = useTranslations()
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [dark, setDark] = useState(false)
  const schedule = process.env.NEXT_PUBLIC_SNAPSHOT_SCHEDULE ?? '0 22 * * *'

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setDark(document.documentElement.getAttribute('data-theme') === 'dark')
    }
  }, [])

  function handleDark(checked: boolean) {
    setDark(checked)
    if (typeof window !== 'undefined') {
      document.documentElement.setAttribute('data-theme', checked ? 'dark' : 'light')
      localStorage.setItem('theme', checked ? 'dark' : 'light')
    }
  }

  function handleLocale(locale: string) {
    startTransition(async () => {
      await setLocale(locale)
      router.refresh()
    })
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
            <button key={locale} onClick={() => handleLocale(locale)} disabled={isPending}
              className={`px-4 py-2 rounded-lg text-sm border transition-colors
                ${isPending ? 'opacity-50 cursor-not-allowed' : ''}
                `}
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
    </main>
  )
}
