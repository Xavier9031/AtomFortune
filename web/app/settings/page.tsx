'use client'
import { useState, useEffect, useRef, useTransition } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { useRouter } from 'next/navigation'
import { Download, Upload, Clock, FlaskConical, Trash2 } from 'lucide-react'
import { setLocale } from '@/app/actions/setLocale'
import { setTheme } from '@/app/actions/setTheme'
import { setExperimental } from '@/app/actions/setExperimental'
import { SUPPORTED_LOCALES } from '@/lib/locales'
import { BASE } from '@/lib/api'
import { fetchWithUser, getActiveUserId } from '@/lib/user'

export default function SettingsPage() {
  const t = useTranslations()
  const locale = useLocale()
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const wasPending = useRef(false)
  const resolveRef = useRef<(() => void) | null>(null)
  const [dark, setDark] = useState(false)
  const [experimental, setExperimentalState] = useState(false)
  const [importMsg, setImportMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [importing, setImporting] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const [resetPhase, setResetPhase] = useState<'idle' | 'armed'>('idle')
  const [resetWord, setResetWord] = useState('')
  const [resetting, setResetting] = useState(false)
  const [resetMsg, setResetMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [holdHovering, setHoldHovering] = useState(false)
  const [holdReady, setHoldReady] = useState(false)
  const [exportPassword, setExportPassword] = useState('')
  const [importPassword, setImportPassword] = useState('')
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

  function handleExport() {
    // Build a direct download URL so the browser handles Content-Disposition: attachment
    // natively — bypasses the async blob-URL trick that breaks in Safari.
    const params = new URLSearchParams()
    const uid = getActiveUserId()
    if (uid) params.set('userId', uid)
    if (exportPassword) params.set('password', exportPassword)
    window.location.href = `${BASE}/backup/export?${params.toString()}`
  }

  async function handleImport(file: File) {
    setImporting(true)
    setImportMsg(null)
    try {
      const form = new FormData()
      form.append('file', file)
      const headers: Record<string, string> = {}
      if (importPassword) headers['x-backup-password'] = importPassword
      const res = await fetchWithUser(`${BASE}/backup/import`, { method: 'POST', body: form, headers })
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

  function holdEnter() {
    setHoldHovering(true)
    holdTimer.current = setTimeout(() => setHoldReady(true), 2500)
  }
  function holdLeave() {
    setHoldHovering(false)
    setHoldReady(false)
    if (holdTimer.current) { clearTimeout(holdTimer.current); holdTimer.current = null }
  }

  async function handleReset() {
    setResetting(true)
    setResetMsg(null)
    try {
      const res = await fetchWithUser(`${BASE}/backup/reset`, { method: 'DELETE' })
      if (res.ok) {
        setResetMsg({ ok: true, text: t('settings.resetSuccess') })
        setResetPhase('idle')
        setResetWord('')
      } else {
        setResetMsg({ ok: false, text: t('settings.resetError') })
      }
    } catch {
      setResetMsg({ ok: false, text: t('settings.resetError') })
    } finally {
      setResetting(false)
    }
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

      {/* Backup & Restore */}
      <section className="bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] overflow-hidden">
        <div className="px-5 py-3 border-b border-[var(--color-border)]">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
            {t('settings.sectionBackup')}
          </h2>
        </div>
        <div className="px-5 py-4 space-y-4">
          <p className="text-sm text-[var(--color-muted)]">{t('settings.backupDesc')}</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-[var(--color-muted)] mb-1 block">{t('settings.exportPassword')}</label>
              <input
                type="password"
                value={exportPassword}
                onChange={e => setExportPassword(e.target.value)}
                placeholder={t('settings.exportPasswordPlaceholder')}
                className="w-full text-sm px-3 py-1.5 rounded-lg border border-[var(--color-border)]
                  bg-[var(--color-bg)] focus:outline-none focus:border-[var(--color-accent)]
                  placeholder:text-[var(--color-muted)]"
              />
            </div>
            <div>
              <label className="text-xs text-[var(--color-muted)] mb-1 block">{t('settings.importPassword')}</label>
              <input
                type="password"
                value={importPassword}
                onChange={e => setImportPassword(e.target.value)}
                placeholder={t('settings.importPasswordPlaceholder')}
                className="w-full text-sm px-3 py-1.5 rounded-lg border border-[var(--color-border)]
                  bg-[var(--color-bg)] focus:outline-none focus:border-[var(--color-accent)]
                  placeholder:text-[var(--color-muted)]"
              />
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={handleExport}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium
                bg-[var(--color-accent)] text-white hover:opacity-90 transition-opacity">
              <Download size={14} />
              {t('settings.exportButton')}
            </button>
            <button onClick={() => fileRef.current?.click()} disabled={importing}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium
                border border-[var(--color-border)] hover:border-[var(--color-accent)]
                hover:text-[var(--color-accent)] transition-colors disabled:opacity-50">
              <Upload size={14} />
              {importing ? t('settings.importing') : t('settings.importButton')}
            </button>
          </div>
          <input ref={fileRef} type="file" accept=".zip" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleImport(f) }} />
          {importMsg && (
            <p className={`text-xs ${importMsg.ok ? 'text-[var(--color-accent)]' : 'text-[var(--color-coral)]'}`}>
              {importMsg.text}
            </p>
          )}
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

      {/* Danger Zone */}
      <section className="bg-[var(--color-surface)] rounded-xl border border-[var(--color-coral)] overflow-hidden">
        <div className="px-5 py-3 border-b border-[var(--color-coral)]">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-coral)]">
            {t('settings.sectionDanger')}
          </h2>
        </div>
        <div className="px-5 py-4 space-y-3">
          <div className="flex items-start gap-3">
            <Trash2 size={14} className="mt-0.5 text-[var(--color-coral)] shrink-0" />
            <div>
              <p className="text-sm font-medium">{t('settings.resetTitle')}</p>
              <p className="text-xs text-[var(--color-muted)] mt-0.5">{t('settings.resetDesc')}</p>
            </div>
          </div>

          {resetPhase === 'idle' ? (
            <button
              onMouseEnter={holdEnter}
              onMouseLeave={holdLeave}
              onClick={() => { if (holdReady) { setResetPhase('armed'); holdLeave() } }}
              className={`relative flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium
                overflow-hidden select-none transition-colors
                ${holdReady
                  ? 'bg-[var(--color-coral)] text-white cursor-pointer'
                  : 'border border-[var(--color-coral)] text-[var(--color-coral)] cursor-default'}`}>
              <div
                className="absolute inset-y-0 left-0 pointer-events-none"
                style={{
                  width: holdHovering && !holdReady ? '115%' : '0%',
                  transition: holdHovering && !holdReady ? 'width 2.5s linear' : 'none',
                  background: 'linear-gradient(to right, rgba(239,68,68,0.2) 0%, rgba(239,68,68,0.4) 70%, rgba(239,68,68,0.55) 87%, transparent 100%)',
                  borderRadius: '0 0.5rem 0.5rem 0',
                  boxShadow: holdHovering && !holdReady ? '3px 0 12px rgba(239,68,68,0.4)' : 'none',
                }}
              />
              <Trash2 size={14} className="relative z-10" />
              <span className="relative z-10">
                {holdReady ? t('settings.resetArmedLabel') : t('settings.resetHoldLabel')}
              </span>
            </button>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-[var(--color-muted)]">
                {t('settings.resetConfirmPlaceholder')}
              </p>
              <input
                type="text"
                value={resetWord}
                onChange={e => { setResetWord(e.target.value); setResetMsg(null) }}
                autoFocus
                className="w-full text-sm px-3 py-2 rounded-lg border border-[var(--color-border)]
                  bg-[var(--color-bg)] placeholder:text-[var(--color-muted)] focus:outline-none
                  focus:border-[var(--color-coral)]"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => { setResetPhase('idle'); setResetWord(''); setResetMsg(null) }}
                  className="px-4 py-2 rounded-lg text-sm border border-[var(--color-border)]
                    hover:border-[var(--color-accent)] transition-colors">
                  {t('common.cancel')}
                </button>
                <button
                  onClick={handleReset}
                  disabled={resetting || resetWord !== t('settings.resetConfirmWord')}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium
                    bg-[var(--color-coral)] text-white hover:opacity-90 transition-opacity
                    disabled:opacity-40 disabled:cursor-not-allowed">
                  <Trash2 size={14} />
                  {resetting ? t('settings.resetting') : t('settings.resetButton')}
                </button>
              </div>
            </div>
          )}

          {resetMsg && (
            <p className={`text-xs ${resetMsg.ok ? 'text-[var(--color-accent)]' : 'text-[var(--color-coral)]'}`}>
              {resetMsg.text}
            </p>
          )}
        </div>
      </section>

    </main>
  )
}
