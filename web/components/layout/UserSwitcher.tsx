'use client'
import { useState, useEffect, useRef } from 'react'
import { useTranslations } from 'next-intl'
import { ChevronDown, Plus, Check, Pencil, Trash2, Upload, X, Download } from 'lucide-react'
import { BASE } from '@/lib/api'
import { getActiveUserId, setActiveUserId, fetchWithUser } from '@/lib/user'

type UserRecord = { id: string; name: string }

export default function UserSwitcher() {
  const t = useTranslations()
  const [open, setOpen] = useState(false)
  const [users, setUsers] = useState<UserRecord[]>([])
  const [activeId, setActiveId] = useState<string>('default-user')

  // new-profile flow: idle → naming → options
  const [newName, setNewName] = useState('')
  const [newStep, setNewStep] = useState<'idle' | 'naming' | 'options'>('idle')
  const [creating, setCreating] = useState(false)

  // rename
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')

  // delete profile confirm
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // current-profile data actions
  const [dataPassword, setDataPassword] = useState('')   // shared pw for export/import
  const [importing, setImporting] = useState(false)
  const [clearConfirm, setClearConfirm] = useState(false)
  const [clearing, setClearing] = useState(false)

  const dropdownRef = useRef<HTMLDivElement>(null)
  const importRef = useRef<HTMLInputElement>(null)      // import into current profile
  const newImportRef = useRef<HTMLInputElement>(null)   // import when creating new profile

  useEffect(() => {
    setActiveId(getActiveUserId())
    fetchUsers()
  }, [])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        closeDropdown()
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  function closeDropdown() {
    setOpen(false)
    setNewStep('idle'); setNewName(''); setCreating(false)
    setEditingId(null); setEditingName('')
    setDeletingId(null)
    setClearConfirm(false)
  }

  async function fetchUsers() {
    try {
      const res = await fetch(`${BASE}/users`)
      if (res.ok) setUsers(await res.json())
    } catch {}
  }

  // ── Switch ────────────────────────────────────────────────────────────────

  function handleSwitch(id: string) {
    if (id === activeId) { closeDropdown(); return }
    setActiveUserId(id); setActiveId(id)
    closeDropdown(); window.location.reload()
  }

  // ── New profile ──────────────────────────────────────────────────────────

  async function createEmpty() {
    if (!newName.trim() || creating) return
    setCreating(true)
    try {
      const res = await fetch(`${BASE}/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim() }),
      })
      if (res.ok) {
        const user: UserRecord = await res.json()
        setUsers(p => [...p, user])
        setActiveUserId(user.id); setActiveId(user.id)
        closeDropdown(); window.location.reload()
      }
    } catch { setCreating(false) }
  }

  async function handleNewImportFile(file: File) {
    if (!newName.trim()) return
    setCreating(true)
    try {
      const cr = await fetch(`${BASE}/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim() }),
      })
      if (!cr.ok) { setCreating(false); return }
      const user: UserRecord = await cr.json()
      const form = new FormData()
      form.append('file', file)
      await fetch(`${BASE}/backup/import`, {
        method: 'POST',
        headers: { 'x-user-id': user.id },
        body: form,
      })
      setUsers(p => [...p, user])
      setActiveUserId(user.id); setActiveId(user.id)
      closeDropdown(); window.location.reload()
    } catch { setCreating(false) }
  }

  // ── Rename ────────────────────────────────────────────────────────────────

  async function handleRename(id: string) {
    if (!editingName.trim()) return
    const res = await fetchWithUser(`${BASE}/users/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: editingName.trim() }),
    })
    if (res.ok) {
      const updated = await res.json()
      setUsers(p => p.map(u => u.id === id ? updated : u))
      setEditingId(null); setEditingName('')
    }
  }

  // ── Delete profile ────────────────────────────────────────────────────────

  async function handleDeleteProfile(id: string) {
    const res = await fetchWithUser(`${BASE}/users/${id}`, { method: 'DELETE' })
    if (res.status === 204) {
      const rem = users.filter(u => u.id !== id)
      setUsers(rem); setDeletingId(null)
      if (id === activeId && rem.length > 0) {
        setActiveUserId(rem[0].id); setActiveId(rem[0].id)
        closeDropdown(); window.location.reload()
      }
    }
  }

  // ── Current-profile data actions ─────────────────────────────────────────

  function handleExport() {
    const params = new URLSearchParams({ userId: activeId })
    if (dataPassword) params.set('password', dataPassword)
    window.location.href = `${BASE}/backup/export?${params.toString()}`
  }

  async function handleImportFile(file: File) {
    setImporting(true)
    try {
      const form = new FormData()
      form.append('file', file)
      const headers: Record<string, string> = {}
      if (dataPassword) headers['x-backup-password'] = dataPassword
      await fetchWithUser(`${BASE}/backup/import`, { method: 'POST', body: form, headers })
      closeDropdown(); window.location.reload()
    } catch { setImporting(false) }
    if (importRef.current) importRef.current.value = ''
  }

  async function handleClear() {
    setClearing(true)
    try {
      await fetchWithUser(`${BASE}/backup/reset`, { method: 'DELETE' })
      closeDropdown(); window.location.reload()
    } catch { setClearing(false) }
  }

  const activeUser = users.find(u => u.id === activeId)
  const initial = (activeUser?.name ?? 'D').charAt(0).toUpperCase()

  return (
    <div className="relative mx-2 mb-4" ref={dropdownRef}>

      {/* ── Trigger ──────────────────────────────────────────────────────── */}
      <button
        onClick={() => { if (open) closeDropdown(); else setOpen(true) }}
        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg
          hover:bg-[var(--color-bg)] text-[var(--color-text)] text-sm transition-colors"
      >
        <span className="w-7 h-7 rounded-full bg-[var(--color-accent)] text-white flex items-center
          justify-center text-xs font-bold shrink-0">
          {initial}
        </span>
        <span className="flex-1 text-left truncate font-medium">
          {activeUser?.name ?? t('userSwitcher.defaultUser')}
        </span>
        <ChevronDown size={14} className={`shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {/* ── Dropdown ─────────────────────────────────────────────────────── */}
      {open && (
        <div className="absolute bottom-full left-0 right-0 mb-1 bg-[var(--color-surface)]
          border border-[var(--color-border)] rounded-xl shadow-lg overflow-hidden z-50">

          {/* ① Profile list */}
          <div className="max-h-40 overflow-y-auto">
            {users.map(u => (
              <div key={u.id} className="group flex items-center gap-1 px-2.5 py-1.5
                hover:bg-[var(--color-bg)] transition-colors">

                {editingId === u.id ? (
                  <>
                    <span className="w-5 h-5 rounded-full bg-[var(--color-accent)]/20 text-[var(--color-accent)]
                      flex items-center justify-center text-xs font-bold shrink-0">
                      {u.name.charAt(0).toUpperCase()}
                    </span>
                    <input autoFocus value={editingName}
                      onChange={e => setEditingName(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') handleRename(u.id)
                        if (e.key === 'Escape') { setEditingId(null); setEditingName('') }
                      }}
                      className="flex-1 text-xs px-1.5 py-0.5 rounded border border-[var(--color-accent)]
                        bg-[var(--color-bg)] focus:outline-none min-w-0"
                    />
                    <button onClick={() => handleRename(u.id)} className="p-0.5 text-[var(--color-accent)] shrink-0">
                      <Check size={11} />
                    </button>
                    <button onClick={() => { setEditingId(null); setEditingName('') }}
                      className="p-0.5 text-[var(--color-muted)] shrink-0">
                      <X size={11} />
                    </button>
                  </>
                ) : deletingId === u.id ? (
                  <>
                    <span className="flex-1 text-xs text-[var(--color-coral)] truncate">
                      {t('userSwitcher.deleteConfirm', { name: u.name })}
                    </span>
                    <button onClick={() => handleDeleteProfile(u.id)}
                      className="text-xs px-1.5 py-0.5 rounded bg-[var(--color-coral)] text-white shrink-0">
                      {t('common.delete')}
                    </button>
                    <button onClick={() => setDeletingId(null)}
                      className="p-0.5 text-[var(--color-muted)] shrink-0"><X size={11} /></button>
                  </>
                ) : (
                  <>
                    <button onClick={() => handleSwitch(u.id)}
                      className="flex-1 flex items-center gap-1.5 min-w-0 text-left">
                      <span className="w-5 h-5 rounded-full bg-[var(--color-accent)]/20 text-[var(--color-accent)]
                        flex items-center justify-center text-xs font-bold shrink-0">
                        {u.name.charAt(0).toUpperCase()}
                      </span>
                      <span className="flex-1 truncate text-xs">{u.name}</span>
                      {u.id === activeId && <Check size={11} className="text-[var(--color-accent)] shrink-0" />}
                    </button>
                    <button onClick={e => { e.stopPropagation(); setEditingId(u.id); setEditingName(u.name) }}
                      className="p-0.5 text-[var(--color-muted)] hover:text-[var(--color-text)]
                        opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                      <Pencil size={11} />
                    </button>
                    <button onClick={e => { e.stopPropagation(); if (u.id !== activeId) setDeletingId(u.id) }}
                      disabled={u.id === activeId}
                      className="p-0.5 text-[var(--color-muted)] hover:text-[var(--color-coral)]
                        opacity-0 group-hover:opacity-100 transition-opacity shrink-0
                        disabled:opacity-0 disabled:cursor-not-allowed">
                      <Trash2 size={11} />
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>

          {/* ② Current-profile data actions */}
          <div className="border-t border-[var(--color-border)] px-2.5 py-2 space-y-1.5">
            <p className="text-xs font-medium text-[var(--color-muted)] truncate">
              {activeUser?.name ?? ''} — {t('userSwitcher.dataSection')}
            </p>

            {/* Optional encryption password */}
            <input
              type="password"
              value={dataPassword}
              onChange={e => setDataPassword(e.target.value)}
              placeholder={t('userSwitcher.passwordPlaceholder')}
              className="w-full text-xs px-2 py-1 rounded border border-[var(--color-border)]
                bg-[var(--color-bg)] focus:outline-none focus:border-[var(--color-accent)]
                placeholder:text-[var(--color-muted)]"
            />

            {clearConfirm ? (
              <div className="flex items-center gap-1.5">
                <span className="flex-1 text-xs text-[var(--color-coral)]">
                  {t('userSwitcher.clearConfirm')}
                </span>
                <button onClick={handleClear} disabled={clearing}
                  className="text-xs px-2 py-0.5 rounded bg-[var(--color-coral)] text-white
                    disabled:opacity-50 shrink-0">
                  {clearing ? t('userSwitcher.clearing') : t('common.confirm')}
                </button>
                <button onClick={() => setClearConfirm(false)}
                  className="p-0.5 text-[var(--color-muted)] shrink-0"><X size={11} /></button>
              </div>
            ) : (
              <div className="flex gap-1.5">
                <button onClick={handleExport}
                  className="flex-1 flex items-center justify-center gap-1 text-xs py-1 rounded
                    border border-[var(--color-border)] hover:border-[var(--color-accent)]
                    hover:text-[var(--color-accent)] transition-colors">
                  <Download size={11} />
                  {t('userSwitcher.export')}
                </button>
                <button onClick={() => importRef.current?.click()} disabled={importing}
                  className="flex-1 flex items-center justify-center gap-1 text-xs py-1 rounded
                    border border-[var(--color-border)] hover:border-[var(--color-accent)]
                    hover:text-[var(--color-accent)] transition-colors disabled:opacity-50">
                  <Upload size={11} />
                  {importing ? t('userSwitcher.importing') : t('userSwitcher.import')}
                </button>
                <button onClick={() => setClearConfirm(true)}
                  title={t('userSwitcher.clearData')}
                  className="flex items-center justify-center px-2 py-1 rounded
                    border border-[var(--color-border)] hover:border-[var(--color-coral)]
                    hover:text-[var(--color-coral)] transition-colors">
                  <Trash2 size={11} />
                </button>
              </div>
            )}
          </div>

          {/* ③ New profile */}
          <div className="border-t border-[var(--color-border)]">
            {newStep === 'idle' && (
              <button onClick={() => setNewStep('naming')}
                className="w-full flex items-center gap-1.5 px-2.5 py-2 text-xs
                  text-[var(--color-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-bg)]
                  transition-colors">
                <Plus size={12} />
                {t('userSwitcher.newProfile')}
              </button>
            )}

            {newStep === 'naming' && (
              <div className="px-2.5 py-1.5 flex items-center gap-1.5">
                <input autoFocus value={newName}
                  onChange={e => setNewName(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && newName.trim()) setNewStep('options')
                    if (e.key === 'Escape') { setNewStep('idle'); setNewName('') }
                  }}
                  placeholder={t('userSwitcher.newProfilePlaceholder')}
                  className="flex-1 text-xs px-2 py-1 rounded border border-[var(--color-border)]
                    bg-[var(--color-bg)] focus:outline-none focus:border-[var(--color-accent)]
                    placeholder:text-[var(--color-muted)] min-w-0"
                />
                <button onClick={() => { if (newName.trim()) setNewStep('options') }}
                  disabled={!newName.trim()}
                  className="text-xs px-2 py-1 rounded bg-[var(--color-accent)] text-white
                    disabled:opacity-40 shrink-0">
                  {t('common.next')}
                </button>
                <button onClick={() => { setNewStep('idle'); setNewName('') }}
                  className="p-0.5 text-[var(--color-muted)] shrink-0"><X size={12} /></button>
              </div>
            )}

            {newStep === 'options' && (
              <div className="px-2.5 py-1.5 space-y-1.5">
                <p className="text-xs text-[var(--color-muted)] truncate">
                  {t('userSwitcher.setupProfile', { name: newName })}
                </p>
                <div className="flex gap-1.5">
                  <button onClick={createEmpty} disabled={creating}
                    className="flex-1 text-xs px-2 py-1 rounded border border-[var(--color-border)]
                      hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]
                      transition-colors disabled:opacity-50">
                    {t('userSwitcher.startEmpty')}
                  </button>
                  <button onClick={() => newImportRef.current?.click()} disabled={creating}
                    className="flex-1 flex items-center justify-center gap-1 text-xs px-2 py-1 rounded
                      bg-[var(--color-accent)] text-white disabled:opacity-50">
                    <Upload size={10} />
                    {creating ? t('userSwitcher.importing') : t('userSwitcher.importBackup')}
                  </button>
                </div>
                <button onClick={() => setNewStep('naming')}
                  className="text-xs text-[var(--color-muted)] hover:text-[var(--color-text)] transition-colors">
                  ← {t('common.back')}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Hidden file inputs */}
      <input ref={importRef} type="file" accept=".zip" className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) handleImportFile(f) }} />
      <input ref={newImportRef} type="file" accept=".zip" className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) handleNewImportFile(f) }} />
    </div>
  )
}
