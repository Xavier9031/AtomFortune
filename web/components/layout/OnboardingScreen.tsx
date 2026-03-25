'use client'
import { useState, useEffect, useRef } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { UserPlus, Upload, Moon, Sun } from 'lucide-react'
import Image from 'next/image'
import { BASE } from '@/lib/api'
import { setActiveUserId } from '@/lib/user'
import { setLocale } from '@/app/actions/setLocale'
import { setTheme } from '@/app/actions/setTheme'
import { SUPPORTED_LOCALES } from '@/lib/locales'
import { useCurrency } from '@/context/CurrencyContext'
import type { Currency } from '@/lib/types'

const POPULAR_CURRENCIES: Currency[] = ['TWD', 'USD', 'JPY', 'EUR', 'CNY', 'HKD', 'SGD', 'KRW']

type Step = 'choose' | 'fresh' | 'import'

function nameFromFilename(filename: string): string {
  const m = filename.match(/^AF-(.+)-\d{4}-\d{2}-\d{2}/)
  return m ? m[1].replace(/_/g, ' ') : 'Imported'
}

export default function OnboardingScreen() {
  const t = useTranslations()
  const locale = useLocale()
  const { setCurrency } = useCurrency()
  const [visible, setVisible] = useState(false)
  const [step, setStep] = useState<Step>('choose')
  const [name, setName] = useState('')
  const [baseCurrency, setBaseCurrency] = useState<Currency>('TWD')
  const [importPw, setImportPw] = useState('')
  const [loading, setLoading] = useState(false)
  const [dark, setDark] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setDark(document.documentElement.dataset.theme === 'dark')
    fetch(`${BASE}/users`)
      .then(r => r.json())
      .then((users: { id: string }[]) => { if (!users.length) setVisible(true) })
      .catch(() => {})
  }, [])

  function reset() { setStep('choose'); setName(''); setImportPw('') }

  async function handleLocale(loc: string) {
    await setLocale(loc)
    window.location.reload()
  }

  async function handleTheme(isDark: boolean) {
    setDark(isDark)
    document.documentElement.dataset.theme = isDark ? 'dark' : 'light'
    await setTheme(isDark ? 'dark' : 'light')
  }

  async function handleCreate() {
    if (!name.trim() || loading) return
    setLoading(true)
    try {
      const res = await fetch(`${BASE}/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() }),
      })
      if (res.ok) {
        const user = await res.json()
        setActiveUserId(user.id)
        setCurrency(baseCurrency)
        window.location.reload()
      }
    } finally { setLoading(false) }
  }

  async function handleImport(file: File) {
    if (loading) return
    setLoading(true)
    try {
      const profileName = nameFromFilename(file.name)
      const cr = await fetch(`${BASE}/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: profileName }),
      })
      if (!cr.ok) return
      const user = await cr.json()
      const form = new FormData()
      form.append('file', file)
      const headers: Record<string, string> = { 'x-user-id': user.id }
      if (importPw) headers['x-backup-password'] = importPw
      await fetch(`${BASE}/backup/import`, { method: 'POST', headers, body: form })
      setActiveUserId(user.id)
      window.location.reload()
    } finally { setLoading(false) }
  }

  if (!visible) return null

  return (
    <div className="fixed inset-0 z-[300] bg-[var(--color-bg)] flex flex-col">

      {/* Top bar: language + theme */}
      <div className="flex items-center justify-between px-6 py-4">
        <div className="flex rounded-lg overflow-hidden border border-[var(--color-border)]">
          {SUPPORTED_LOCALES.map(loc => (
            <button key={loc} onClick={() => handleLocale(loc)}
              className={`px-3 py-1.5 text-xs font-medium transition-colors
                ${loc === locale
                  ? 'bg-[var(--color-accent)] text-white'
                  : 'hover:bg-[var(--color-bg)] text-[var(--color-muted)]'}`}>
              {loc === 'zh-TW' ? '繁中' : 'EN'}
            </button>
          ))}
        </div>
        <button onClick={() => handleTheme(!dark)}
          className="p-2 rounded-lg border border-[var(--color-border)]
            hover:bg-[var(--color-surface)] transition-colors text-[var(--color-muted)]">
          {dark ? <Sun size={16} /> : <Moon size={16} />}
        </button>
      </div>

      {/* Centered content */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-sm space-y-8">

          {/* Logo + title */}
          <div className="text-center space-y-3">
            <Image src="/icon-192.png" alt="Atom Fortune" width={72} height={72}
              className="mx-auto rounded-[20px] shadow-md" />
            <div className="space-y-1">
              <h1 className="text-2xl font-bold tracking-tight">Atom Fortune</h1>
              <p className="text-sm text-[var(--color-muted)]">{t('onboarding.subtitle')}</p>
            </div>
          </div>

          {/* Step: choose */}
          {step === 'choose' && (
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => setStep('fresh')}
                className="flex flex-col items-center gap-3 p-5 rounded-2xl border-2
                  border-[var(--color-border)] hover:border-[var(--color-accent)]
                  hover:text-[var(--color-accent)] transition-all duration-200 group">
                <UserPlus size={26} className="text-[var(--color-muted)] group-hover:text-[var(--color-accent)] transition-colors" />
                <div className="text-center">
                  <p className="text-sm font-semibold">{t('onboarding.startFresh')}</p>
                  <p className="text-xs text-[var(--color-muted)] mt-0.5">{t('onboarding.startFreshDesc')}</p>
                </div>
              </button>
              <button onClick={() => setStep('import')}
                className="flex flex-col items-center gap-3 p-5 rounded-2xl border-2
                  border-[var(--color-border)] hover:border-[var(--color-accent)]
                  hover:text-[var(--color-accent)] transition-all duration-200 group">
                <Upload size={26} className="text-[var(--color-muted)] group-hover:text-[var(--color-accent)] transition-colors" />
                <div className="text-center">
                  <p className="text-sm font-semibold">{t('onboarding.importBackup')}</p>
                  <p className="text-xs text-[var(--color-muted)] mt-0.5">{t('onboarding.importBackupDesc')}</p>
                </div>
              </button>
            </div>
          )}

          {/* Step: start fresh */}
          {step === 'fresh' && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">{t('onboarding.profileNameLabel')}</label>
                <input autoFocus value={name} onChange={e => setName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleCreate() }}
                  placeholder={t('onboarding.profileNamePlaceholder')}
                  className="w-full text-sm px-3 py-2.5 rounded-xl border border-[var(--color-border)]
                    bg-[var(--color-surface)] focus:outline-none focus:border-[var(--color-accent)]
                    placeholder:text-[var(--color-muted)]"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">{t('onboarding.baseCurrencyLabel')}</label>
                <div className="flex flex-wrap gap-2">
                  {POPULAR_CURRENCIES.map(c => (
                    <button key={c} onClick={() => setBaseCurrency(c)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-mono font-medium border transition-colors
                        ${baseCurrency === c
                          ? 'bg-[var(--color-accent)] border-[var(--color-accent)] text-white'
                          : 'border-[var(--color-border)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]'}`}>
                      {c}
                    </button>
                  ))}
                </div>
              </div>
              <button onClick={handleCreate} disabled={!name.trim() || loading}
                className="w-full py-2.5 rounded-xl bg-[var(--color-accent)] text-white
                  font-medium disabled:opacity-40 transition-opacity">
                {loading ? t('common.loading') : t('onboarding.getStarted')}
              </button>
              <button onClick={reset}
                className="w-full text-sm text-[var(--color-muted)] hover:text-[var(--color-text)] transition-colors">
                ← {t('common.back')}
              </button>
            </div>
          )}

          {/* Step: import */}
          {step === 'import' && (
            <div className="space-y-4">
              <p className="text-xs text-[var(--color-muted)]">{t('onboarding.importDesc')}</p>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-[var(--color-muted)]">
                  {t('settings.importPassword')}
                </label>
                <input type="password" value={importPw} onChange={e => setImportPw(e.target.value)}
                  placeholder={t('settings.importPasswordPlaceholder')}
                  className="w-full text-sm px-3 py-2.5 rounded-xl border border-[var(--color-border)]
                    bg-[var(--color-surface)] focus:outline-none focus:border-[var(--color-accent)]
                    placeholder:text-[var(--color-muted)]"
                />
              </div>
              <button onClick={() => fileRef.current?.click()} disabled={loading}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl
                  bg-[var(--color-accent)] text-white font-medium disabled:opacity-40 transition-opacity">
                <Upload size={16} />
                {loading ? t('userSwitcher.importing') : t('onboarding.chooseFile')}
              </button>
              <input ref={fileRef} type="file" accept=".zip" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) handleImport(f) }} />
              <button onClick={reset}
                className="w-full text-sm text-[var(--color-muted)] hover:text-[var(--color-text)] transition-colors">
                ← {t('common.back')}
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
