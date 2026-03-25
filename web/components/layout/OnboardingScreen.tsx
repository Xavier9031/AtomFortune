'use client'
import { useState, useEffect, useRef } from 'react'
import { useTranslations } from 'next-intl'
import { UserPlus, Upload } from 'lucide-react'
import { BASE } from '@/lib/api'
import { setActiveUserId } from '@/lib/user'

type Step = 'choose' | 'fresh' | 'import'

export default function OnboardingScreen() {
  const t = useTranslations()
  const [visible, setVisible] = useState(false)
  const [step, setStep] = useState<Step>('choose')
  const [name, setName] = useState('')
  const [importPw, setImportPw] = useState('')
  const [loading, setLoading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetch(`${BASE}/users`)
      .then(r => r.json())
      .then((users: { id: string }[]) => { if (!users.length) setVisible(true) })
      .catch(() => {})
  }, [])

  function reset() { setStep('choose'); setName(''); setImportPw('') }

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
        window.location.reload()
      }
    } finally { setLoading(false) }
  }

  async function handleImport(file: File) {
    if (!name.trim() || loading) return
    setLoading(true)
    try {
      const cr = await fetch(`${BASE}/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() }),
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
    <div className="fixed inset-0 z-[300] bg-[var(--color-bg)] flex items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-8">

        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold tracking-tight">Atom Fortune</h1>
          <p className="text-sm text-[var(--color-muted)]">
            {t('onboarding.subtitle')}
          </p>
        </div>

        {/* Choose */}
        {step === 'choose' && (
          <div className="grid grid-cols-2 gap-3">
            <button onClick={() => setStep('fresh')}
              className="flex flex-col items-center gap-3 p-5 rounded-2xl
                border-2 border-[var(--color-border)] hover:border-[var(--color-accent)]
                hover:text-[var(--color-accent)] transition-all duration-200 group">
              <UserPlus size={26} className="text-[var(--color-muted)] group-hover:text-[var(--color-accent)] transition-colors" />
              <div className="text-center">
                <p className="text-sm font-semibold">{t('onboarding.startFresh')}</p>
                <p className="text-xs text-[var(--color-muted)] mt-0.5">{t('onboarding.startFreshDesc')}</p>
              </div>
            </button>
            <button onClick={() => setStep('import')}
              className="flex flex-col items-center gap-3 p-5 rounded-2xl
                border-2 border-[var(--color-border)] hover:border-[var(--color-accent)]
                hover:text-[var(--color-accent)] transition-all duration-200 group">
              <Upload size={26} className="text-[var(--color-muted)] group-hover:text-[var(--color-accent)] transition-colors" />
              <div className="text-center">
                <p className="text-sm font-semibold">{t('onboarding.importBackup')}</p>
                <p className="text-xs text-[var(--color-muted)] mt-0.5">{t('onboarding.importBackupDesc')}</p>
              </div>
            </button>
          </div>
        )}

        {/* Start fresh */}
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

        {/* Import backup */}
        {step === 'import' && (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">{t('onboarding.profileNameLabel')}</label>
              <input autoFocus value={name} onChange={e => setName(e.target.value)}
                placeholder={t('onboarding.profileNamePlaceholder')}
                className="w-full text-sm px-3 py-2.5 rounded-xl border border-[var(--color-border)]
                  bg-[var(--color-surface)] focus:outline-none focus:border-[var(--color-accent)]
                  placeholder:text-[var(--color-muted)]"
              />
            </div>
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
            <button onClick={() => fileRef.current?.click()} disabled={!name.trim() || loading}
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
  )
}
