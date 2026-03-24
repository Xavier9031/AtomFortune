'use client'
import { useState, useEffect, useRef, useTransition } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { useRouter } from 'next/navigation'
import { Clock, FlaskConical } from 'lucide-react'
import { setLocale } from '@/app/actions/setLocale'
import { setTheme } from '@/app/actions/setTheme'
import { setExperimental } from '@/app/actions/setExperimental'
import { SUPPORTED_LOCALES } from '@/lib/locales'

export default function SettingsPage() {
  const t = useTranslations()
  const locale = useLocale()
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const wasPending = useRef(false)
  const resolveRef = useRef<(() => void) | null>(null)
  const [dark, setDark] = useState(false)
  const [experimental, setExperimentalState] = useState(false)
  const schedule = process.env.NEXT_PUBLIC_SNAPSHOT_SCHEDULE ?? '0 22 * * *'

  useEffect(() => {
    setDark(document.documentElement.dataset.theme === 'dark')
    setExperimentalState(document.documentElement.dataset.experimental === 'true')
  }, [])

  useEffect(() => {
    if (wasPending.current && !isPending) {
      wasPending.current = false
      resolveRef.current?.()
      resolveRef.current = null
    }
  }, [isPending])

  async function handleExperimental(checked: boolean) {
    setExperimentalState(checked)
    document.documentElement.dataset.experimental = checked ? 'true' : ''
    await setExperimental(checked)
  }

  async function handleDark(checked: boolean) {
    setDark(checked)
    const html = document.documentElement
    html.classList.add('theme-changing')
    html.dataset.theme = checked ? 'dark' : 'light'
    await setTheme(checked ? 'dark' : 'light')
    setTimeout(() => html.classList.remove('theme-changing'), 350)
  }

  async function handleLocale(next: string) {
    if (!document.startViewTransition) {
      await setLocale(next)
      wasPending.current = true
      startTransition(() => router.refresh())
      return
    }
    document.startViewTransition(() => new Promise<void>((resolve) => {
      resolveRef.current = resolve
      wasPending.current = true
      setLocale(next).then(() => startTransition(() => router.refresh()))
    }))
  }

  return (
    <main className="p-6 max-w-lg mx-auto space-y-5">
      <h1 className="text-xl font-bold">{t('settings.title')}</h1>

      {/* Appearance */}
      <section className="bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] overflow-hidden">
        <div className="px-5 py-3 border-b border-[var(--color-border)]">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
            {t('settings.sectionAppearance')}
          </h2>
        </div>
        <div className="divide-y divide-[var(--color-border)]">

          <div className="flex items-center justify-between px-5 py-4">
            <p className="text-sm font-medium">{t('settings.language')}</p>
            <div className="flex rounded-lg overflow-hidden border border-[var(--color-border)]">
              {SUPPORTED_LOCALES.map(loc => (
                <button key={loc}
                  onClick={() => handleLocale(loc)}
                  disabled={isPending}
                  className={`px-4 py-1.5 text-sm font-medium transition-colors disabled:opacity-50
                    ${loc === locale
                      ? 'bg-[var(--color-accent)] text-white'
                      : 'hover:bg-[var(--color-bg)]'}`}>
                  {t(`settings.languages.${loc}` as Parameters<typeof t>[0])}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between px-5 py-4">
            <p className="text-sm font-medium">{t('settings.darkMode')}</p>
            <button
              role="switch"
              aria-checked={dark}
              onClick={() => handleDark(!dark)}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors
                ${dark ? 'bg-[var(--color-accent)]' : 'bg-[var(--color-border)]'}`}>
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform
                ${dark ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>

        </div>
      </section>

      {/* System */}
      <section className="bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] overflow-hidden">
        <div className="px-5 py-3 border-b border-[var(--color-border)]">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
            {t('settings.sectionSystem')}
          </h2>
        </div>
        <div className="divide-y divide-[var(--color-border)]">
          <div className="flex items-center justify-between px-5 py-4">
            <div className="flex items-start gap-3">
              <FlaskConical size={14} className="mt-0.5 text-[var(--color-muted)] shrink-0" />
              <div>
                <p className="text-sm font-medium">{t('settings.experimentalMode')}</p>
                <p className="text-xs text-[var(--color-muted)] mt-0.5">{t('settings.experimentalModeDesc')}</p>
              </div>
            </div>
            <button
              role="switch"
              aria-checked={experimental}
              onClick={() => handleExperimental(!experimental)}
              className={`ml-4 relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors
                ${experimental ? 'bg-[var(--color-accent)]' : 'bg-[var(--color-border)]'}`}>
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform
                ${experimental ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>
          <div className="px-5 py-4">
            <div className="flex items-start gap-3">
              <Clock size={14} className="mt-0.5 text-[var(--color-muted)] shrink-0" />
              <div className="space-y-1.5">
                <p className="text-sm font-medium">{t('settings.snapshotSchedule')}</p>
                <code className="block text-xs bg-[var(--color-bg)] px-2.5 py-1 rounded border border-[var(--color-border)]">
                  {schedule}
                </code>
                <p className="text-xs text-[var(--color-muted)]">{t('settings.snapshotScheduleDesc')}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

    </main>
  )
}
