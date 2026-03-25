'use client'
import { useState, useEffect, useRef } from 'react'
import { useTranslations } from 'next-intl'
import { ChevronDown, ChevronLeft, Plus, Check, Pencil, Trash2, Upload, X, Download, MoreHorizontal } from 'lucide-react'
import { BASE } from '@/lib/api'
import { getActiveUserId, setActiveUserId } from '@/lib/user'

type UserRecord = { id: string; name: string }
type PanelMode = 'actions' | 'export' | 'import' | 'clear' | 'delete'

export default function UserSwitcher() {
  const t = useTranslations()
  const [open, setOpen] = useState(false)
  const [users, setUsers] = useState<UserRecord[]>([])
  const [activeId, setActiveId] = useState<string>('default-user')
  const [switching, setSwitching] = useState(false)

  // new-profile flow: idle → naming → options
  const [newName, setNewName] = useState('')
  const [newStep, setNewStep] = useState<'idle' | 'naming' | 'options'>('idle')
  const [creating, setCreating] = useState(false)

  // rename inline
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')

  // per-profile expanded action panel
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [panelMode, setPanelMode] = useState<PanelMode>('actions')
  const [panelPassword, setPanelPassword] = useState('')
  const [clearWord, setClearWord] = useState('')
  const [importing, setImporting] = useState(false)
  const [clearing, setClearing] = useState(false)

  const dropdownRef = useRef<HTMLDivElement>(null)
  const panelImportRef = useRef<HTMLInputElement>(null)
  const newImportRef = useRef<HTMLInputElement>(null)

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
    resetPanel()
  }

  function resetPanel() {
    setExpandedId(null); setPanelMode('actions')
    setPanelPassword(''); setClearWord('')
  }

  function toggleExpanded(id: string) {
    if (expandedId === id) { resetPanel(); return }
    setExpandedId(id)
    setPanelMode('actions'); setPanelPassword(''); setClearWord('')
  }

  async function fetchUsers() {
    try {
      const res = await fetch(`${BASE}/users`)
      if (res.ok) setUsers(await res.json())
    } catch {}
  }

  // ── Switch (with fade animation) ─────────────────────────────────────────

  async function handleSwitch(id: string) {
    if (id === activeId) { closeDropdown(); return }
    setSwitching(true)
    await new Promise(r => setTimeout(r, 180))
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
    const res = await fetch(`${BASE}/users/${id}`, {
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
    const res = await fetch(`${BASE}/users/${id}`, { method: 'DELETE' })
    if (res.status === 204) {
      const rem = users.filter(u => u.id !== id)
      setUsers(rem); resetPanel()
      if (id === activeId && rem.length > 0) {
        setActiveUserId(rem[0].id); setActiveId(rem[0].id)
        closeDropdown(); window.location.reload()
      }
    }
  }

  // ── Per-profile data actions ──────────────────────────────────────────────

  function handleExport(userId: string) {
    const params = new URLSearchParams({ userId })
    if (panelPassword) params.set('password', panelPassword)
    window.location.href = `${BASE}/backup/export?${params.toString()}`
    resetPanel()
  }

  async function handleImportFile(file: File, userId: string) {
    setImporting(true)
    try {
      const form = new FormData()
      form.append('file', file)
      const headers: Record<string, string> = { 'x-user-id': userId }
      if (panelPassword) headers['x-backup-password'] = panelPassword
      await fetch(`${BASE}/backup/import`, { method: 'POST', body: form, headers })
      closeDropdown(); window.location.reload()
    } catch { setImporting(false) }
    if (panelImportRef.current) panelImportRef.current.value = ''
  }

  async function handleClear(userId: string) {
    setClearing(true)
    try {
      const res = await fetch(`${BASE}/backup/reset`, {
        method: 'DELETE',
        headers: { 'x-user-id': userId },
      })
      if (res.ok) {
        if (userId === activeId) { closeDropdown(); window.location.reload() }
        else { setClearing(false); setClearWord(''); resetPanel() }
      }
    } catch { setClearing(false) }
  }

  const activeUser = users.find(u => u.id === activeId)
  const initial = (activeUser?.name ?? 'D').charAt(0).toUpperCase()
  const CONFIRM_WORD = t('userSwitcher.clearConfirmWord')

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="relative mx-2 mb-4" ref={dropdownRef}>

      {/* ── Trigger ──────────────────────────────────────────────────────── */}
      <button
        onClick={() => { if (open) closeDropdown(); else setOpen(true) }}
        className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl
          hover:bg-[var(--color-bg)] text-[var(--color-text)] transition-all duration-200
          ${switching ? 'opacity-40 scale-95' : 'opacity-100 scale-100'}`}
      >
        <span className="w-7 h-7 rounded-full bg-[var(--color-accent)] text-white flex items-center
          justify-center text-xs font-bold shrink-0">
          {initial}
        </span>
        <span className="flex-1 text-left truncate text-sm font-medium">
          {activeUser?.name ?? t('userSwitcher.defaultUser')}
        </span>
        <ChevronDown size={14} className={`shrink-0 text-[var(--color-muted)] transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {/* ── Dropdown ─────────────────────────────────────────────────────── */}
      {open && (
        <div className="absolute bottom-full left-0 right-0 mb-2 bg-[var(--color-surface)]
          border border-[var(--color-border)] rounded-xl shadow-lg overflow-hidden z-50">

          {/* ① Profile list */}
          <div className="max-h-72 overflow-y-auto py-1">
            {users.map(u => (
              <div key={u.id}>

                {/* Profile row */}
                <div className={`group flex items-center gap-2 px-3 py-2 transition-colors
                  ${expandedId === u.id ? 'bg-[var(--color-bg)]' : 'hover:bg-[var(--color-bg)]'}`}>

                  {editingId === u.id ? (
                    /* Rename mode */
                    <>
                      <span className="w-6 h-6 rounded-full bg-[var(--color-accent)]/15 text-[var(--color-accent)]
                        flex items-center justify-center text-xs font-bold shrink-0">
                        {u.name.charAt(0).toUpperCase()}
                      </span>
                      <input autoFocus value={editingName}
                        onChange={e => setEditingName(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') handleRename(u.id)
                          if (e.key === 'Escape') { setEditingId(null); setEditingName('') }
                        }}
                        className="flex-1 text-sm px-2 py-0.5 rounded-lg border border-[var(--color-accent)]
                          bg-[var(--color-surface)] focus:outline-none min-w-0"
                      />
                      <button onClick={() => handleRename(u.id)}
                        className="p-1 rounded-md text-[var(--color-accent)] hover:bg-[var(--color-accent)]/10 shrink-0">
                        <Check size={12} />
                      </button>
                      <button onClick={() => { setEditingId(null); setEditingName('') }}
                        className="p-1 rounded-md text-[var(--color-muted)] hover:bg-[var(--color-bg)] shrink-0">
                        <X size={12} />
                      </button>
                    </>
                  ) : (
                    /* Normal mode */
                    <>
                      <button onClick={() => handleSwitch(u.id)}
                        className="flex-1 flex items-center gap-2 min-w-0 text-left">
                        <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0
                          ${u.id === activeId ? 'bg-[var(--color-accent)] text-white' : 'bg-[var(--color-accent)]/15 text-[var(--color-accent)]'}`}>
                          {u.name.charAt(0).toUpperCase()}
                        </span>
                        <span className="flex-1 truncate text-sm">{u.name}</span>
                        {u.id === activeId && <Check size={13} className="text-[var(--color-accent)] shrink-0" />}
                      </button>
                      {/* Rename — hover only */}
                      <button onClick={e => { e.stopPropagation(); setEditingId(u.id); setEditingName(u.name) }}
                        className="p-1 rounded-md text-[var(--color-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-bg)]
                          opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                        <Pencil size={12} />
                      </button>
                      {/* More actions panel toggle */}
                      <button onClick={e => { e.stopPropagation(); toggleExpanded(u.id) }}
                        className={`p-1 rounded-md transition-colors shrink-0
                          ${expandedId === u.id
                            ? 'text-[var(--color-accent)] bg-[var(--color-accent)]/10'
                            : 'text-[var(--color-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-bg)] opacity-0 group-hover:opacity-100 transition-opacity'}`}>
                        <MoreHorizontal size={13} />
                      </button>
                    </>
                  )}
                </div>

                {/* ── Per-profile action panel ──────────────────────────── */}
                {expandedId === u.id && (
                  <div className="mx-3 mb-2 rounded-xl border border-[var(--color-border)] overflow-hidden">

                    {/* Back header (for sub-steps) */}
                    {panelMode !== 'actions' && (
                      <div className="flex items-center gap-1.5 px-3 py-2 border-b border-[var(--color-border)]
                        bg-[var(--color-bg)]">
                        <button onClick={() => { setPanelMode('actions'); setPanelPassword(''); setClearWord('') }}
                          className="p-0.5 rounded text-[var(--color-muted)] hover:text-[var(--color-text)] transition-colors">
                          <ChevronLeft size={14} />
                        </button>
                        <span className="text-xs font-medium text-[var(--color-muted)] truncate">
                          {u.name}
                        </span>
                        <span className="text-xs text-[var(--color-muted)]">—</span>
                        <span className="text-xs font-medium truncate">
                          {panelMode === 'export' && t('userSwitcher.export')}
                          {panelMode === 'import' && t('userSwitcher.import')}
                          {panelMode === 'clear' && t('userSwitcher.clearData')}
                          {panelMode === 'delete' && t('common.delete')}
                        </span>
                      </div>
                    )}

                    {/* Actions list */}
                    {panelMode === 'actions' && (
                      <div className="p-2.5 space-y-1">
                        <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)] px-1.5 pb-1">
                          {u.name}
                        </p>
                        <div className="grid grid-cols-2 gap-1.5">
                          <button onClick={() => setPanelMode('export')}
                            className="flex items-center justify-center gap-1.5 py-2 text-xs font-medium rounded-lg
                              bg-[var(--color-bg)] border border-[var(--color-border)]
                              hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] transition-colors">
                            <Download size={12} />
                            {t('userSwitcher.export')}
                          </button>
                          <button onClick={() => setPanelMode('import')}
                            className="flex items-center justify-center gap-1.5 py-2 text-xs font-medium rounded-lg
                              bg-[var(--color-bg)] border border-[var(--color-border)]
                              hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] transition-colors">
                            <Upload size={12} />
                            {t('userSwitcher.import')}
                          </button>
                        </div>
                        <button onClick={() => setPanelMode('clear')}
                          className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs rounded-lg
                            text-[var(--color-muted)] hover:text-[var(--color-coral)]
                            hover:bg-[var(--color-coral)]/5 border border-transparent
                            hover:border-[var(--color-coral)]/20 transition-colors">
                          <Trash2 size={12} />
                          {t('userSwitcher.clearData')}
                        </button>
                        {u.id !== activeId && (
                          <button onClick={() => setPanelMode('delete')}
                            className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs rounded-lg
                              text-[var(--color-muted)] hover:text-[var(--color-coral)]
                              hover:bg-[var(--color-coral)]/5 border border-transparent
                              hover:border-[var(--color-coral)]/20 transition-colors">
                            <X size={12} />
                            {t('settings.deleteProfileConfirm', { name: '' }).split('？')[0]}…
                          </button>
                        )}
                      </div>
                    )}

                    {/* Export sub-step */}
                    {panelMode === 'export' && (
                      <div className="p-3 space-y-2.5">
                        <p className="text-xs text-[var(--color-muted)]">
                          {t('settings.exportPassword')}
                        </p>
                        <input
                          autoFocus
                          type="password"
                          value={panelPassword}
                          onChange={e => setPanelPassword(e.target.value)}
                          placeholder={t('settings.exportPasswordPlaceholder')}
                          className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-[var(--color-border)]
                            bg-[var(--color-bg)] focus:outline-none focus:border-[var(--color-accent)]
                            placeholder:text-[var(--color-muted)]"
                        />
                        <button onClick={() => handleExport(u.id)}
                          className="w-full flex items-center justify-center gap-1.5 py-2 text-xs font-medium
                            rounded-lg bg-[var(--color-accent)] text-white hover:opacity-90 transition-opacity">
                          <Download size={12} />
                          {t('userSwitcher.export')}
                        </button>
                      </div>
                    )}

                    {/* Import sub-step */}
                    {panelMode === 'import' && (
                      <div className="p-3 space-y-2.5">
                        <p className="text-xs text-[var(--color-muted)]">
                          {t('settings.importPassword')}
                        </p>
                        <input
                          autoFocus
                          type="password"
                          value={panelPassword}
                          onChange={e => setPanelPassword(e.target.value)}
                          placeholder={t('settings.importPasswordPlaceholder')}
                          className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-[var(--color-border)]
                            bg-[var(--color-bg)] focus:outline-none focus:border-[var(--color-accent)]
                            placeholder:text-[var(--color-muted)]"
                        />
                        <button
                          onClick={() => panelImportRef.current?.click()}
                          disabled={importing}
                          className="w-full flex items-center justify-center gap-1.5 py-2 text-xs font-medium
                            rounded-lg bg-[var(--color-accent)] text-white hover:opacity-90
                            disabled:opacity-50 transition-opacity">
                          <Upload size={12} />
                          {importing ? t('userSwitcher.importing') : t('userSwitcher.import')}
                        </button>
                      </div>
                    )}

                    {/* Clear data sub-step */}
                    {panelMode === 'clear' && (
                      <div className="p-3 space-y-2.5">
                        <p className="text-xs text-[var(--color-coral)]">
                          {t('userSwitcher.clearConfirm')}
                        </p>
                        {/* Show the word to type as a static code block */}
                        <div className="text-xs px-2.5 py-1.5 rounded-lg bg-[var(--color-bg)]
                          border border-[var(--color-border)] font-mono tracking-wide text-center
                          select-all cursor-text text-[var(--color-text)]">
                          {CONFIRM_WORD}
                        </div>
                        <input
                          autoFocus
                          value={clearWord}
                          onChange={e => setClearWord(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Escape') { setPanelMode('actions'); setClearWord('') } }}
                          placeholder={t('userSwitcher.clearTypePlaceholder')}
                          className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-[var(--color-border)]
                            focus:border-[var(--color-coral)] bg-[var(--color-bg)] focus:outline-none
                            placeholder:text-[var(--color-muted)]"
                        />
                        <button
                          onClick={() => handleClear(u.id)}
                          disabled={clearing || clearWord !== CONFIRM_WORD}
                          className="w-full py-1.5 text-xs font-medium rounded-lg
                            bg-[var(--color-coral)] text-white disabled:opacity-30 transition-opacity">
                          {clearing ? t('userSwitcher.clearing') : t('userSwitcher.clearData')}
                        </button>
                      </div>
                    )}

                    {/* Delete profile sub-step */}
                    {panelMode === 'delete' && (
                      <div className="p-3 space-y-2.5">
                        <p className="text-xs text-[var(--color-coral)]">
                          {t('settings.deleteProfileConfirm', { name: u.name })}
                        </p>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            onClick={() => handleDeleteProfile(u.id)}
                            className="py-1.5 text-xs font-medium rounded-lg
                              bg-[var(--color-coral)] text-white hover:opacity-90 transition-opacity">
                            {t('common.delete')}
                          </button>
                          <button
                            onClick={() => setPanelMode('actions')}
                            className="py-1.5 text-xs font-medium rounded-lg border border-[var(--color-border)]
                              hover:bg-[var(--color-bg)] transition-colors">
                            {t('common.cancel')}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* ② New profile */}
          <div className="border-t border-[var(--color-border)]">
            {newStep === 'idle' && (
              <button onClick={() => setNewStep('naming')}
                className="w-full flex items-center gap-2 px-3 py-2.5 text-sm
                  text-[var(--color-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-bg)]
                  transition-colors">
                <Plus size={14} />
                {t('userSwitcher.newProfile')}
              </button>
            )}

            {newStep === 'naming' && (
              <div className="px-3 py-2.5 flex items-center gap-2">
                <input autoFocus value={newName}
                  onChange={e => setNewName(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && newName.trim()) setNewStep('options')
                    if (e.key === 'Escape') { setNewStep('idle'); setNewName('') }
                  }}
                  placeholder={t('userSwitcher.newProfilePlaceholder')}
                  className="flex-1 text-sm px-2.5 py-1.5 rounded-lg border border-[var(--color-border)]
                    bg-[var(--color-bg)] focus:outline-none focus:border-[var(--color-accent)]
                    placeholder:text-[var(--color-muted)] min-w-0"
                />
                <button onClick={() => { if (newName.trim()) setNewStep('options') }}
                  disabled={!newName.trim()}
                  className="text-xs px-3 py-1.5 rounded-lg bg-[var(--color-accent)] text-white
                    disabled:opacity-40 shrink-0">
                  {t('common.next')}
                </button>
                <button onClick={() => { setNewStep('idle'); setNewName('') }}
                  className="p-1 rounded-md text-[var(--color-muted)] hover:bg-[var(--color-bg)] shrink-0">
                  <X size={14} />
                </button>
              </div>
            )}

            {newStep === 'options' && (
              <div className="px-3 py-2.5 space-y-2">
                <p className="text-xs text-[var(--color-muted)]">
                  {t('userSwitcher.setupProfile', { name: newName })}
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={createEmpty} disabled={creating}
                    className="py-2 text-xs font-medium rounded-lg border border-[var(--color-border)]
                      hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]
                      transition-colors disabled:opacity-50">
                    {t('userSwitcher.startEmpty')}
                  </button>
                  <button onClick={() => newImportRef.current?.click()} disabled={creating}
                    className="flex items-center justify-center gap-1.5 py-2 text-xs font-medium rounded-lg
                      bg-[var(--color-accent)] text-white disabled:opacity-50">
                    <Upload size={11} />
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
      <input ref={panelImportRef} type="file" accept=".zip" className="hidden"
        onChange={e => {
          const f = e.target.files?.[0]
          if (f && expandedId) handleImportFile(f, expandedId)
        }} />
      <input ref={newImportRef} type="file" accept=".zip" className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) handleNewImportFile(f) }} />
    </div>
  )
}
