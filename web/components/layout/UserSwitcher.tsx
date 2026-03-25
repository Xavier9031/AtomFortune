'use client'
import { useState, useEffect, useRef } from 'react'
import { useTranslations } from 'next-intl'
import { ChevronDown, Plus, Check, Pencil, Trash2, Upload, X, Download, MoreHorizontal } from 'lucide-react'
import { BASE } from '@/lib/api'
import { getActiveUserId, setActiveUserId } from '@/lib/user'

type UserRecord = { id: string; name: string }

// Hold-to-confirm delete button: hover 2.5 s to arm, then click to fire
function HoldDeleteButton({ onConfirm, label, readyLabel }: { onConfirm: () => void; label: string; readyLabel: string }) {
  const [hovering, setHovering] = useState(false)
  const [ready, setReady] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])

  function enter() {
    setHovering(true)
    timer.current = setTimeout(() => setReady(true), 2500)
  }
  function leave() {
    setHovering(false)
    setReady(false)
    if (timer.current) { clearTimeout(timer.current); timer.current = null }
  }

  return (
    <button
      onClick={() => ready && onConfirm()}
      onMouseEnter={enter}
      onMouseLeave={leave}
      className={`relative w-full flex items-center justify-center gap-2 py-2 text-sm
        border rounded-lg overflow-hidden select-none transition-colors duration-300
        ${ready
          ? 'border-red-500 bg-red-500 text-white cursor-pointer'
          : 'border-red-400 text-red-500 cursor-default'}`}>
      <div
        className="absolute inset-y-0 left-0 pointer-events-none"
        style={{
          width: hovering && !ready ? '115%' : '0%',
          transition: hovering && !ready ? 'width 2.5s linear' : 'none',
          background: 'linear-gradient(to right, rgba(251,146,60,0.25) 0%, rgba(239,68,68,0.45) 70%, rgba(239,68,68,0.6) 87%, transparent 100%)',
          borderRadius: '0 0.375rem 0.375rem 0',
          boxShadow: hovering && !ready ? '3px 0 16px rgba(239,68,68,0.5)' : 'none',
        }}
      />
      <span className="relative z-10 font-medium flex items-center gap-2">
        {!ready && <Trash2 size={14} />}
        {ready ? readyLabel : label}
      </span>
    </button>
  )
}

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

  // profile management modal
  const [modalUser, setModalUser] = useState<UserRecord | null>(null)
  const [exportPw, setExportPw] = useState('')
  const [importPw, setImportPw] = useState('')
  const [importing, setImporting] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [deleteWord, setDeleteWord] = useState('')

  const dropdownRef = useRef<HTMLDivElement>(null)
  const modalImportRef = useRef<HTMLInputElement>(null)
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
  }

  function closeModal() {
    setModalUser(null)
    setExportPw(''); setImportPw('')
    setImporting(false); setDeleteConfirm(false); setDeleteWord('')
  }

  function openModal(u: UserRecord) {
    setModalUser(u)
  }

  async function fetchUsers() {
    try {
      const res = await fetch(`${BASE}/users`)
      if (res.ok) setUsers(await res.json())
    } catch {}
  }

  // ── Switch ────────────────────────────────────────────────────────────────

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

  // ── Modal actions ─────────────────────────────────────────────────────────

  function handleExport(userId: string) {
    const params = new URLSearchParams({ userId })
    if (exportPw) params.set('password', exportPw)
    window.location.href = `${BASE}/backup/export?${params.toString()}`
  }

  async function handleImportFile(file: File, userId: string) {
    setImporting(true)
    try {
      const form = new FormData()
      form.append('file', file)
      const headers: Record<string, string> = { 'x-user-id': userId }
      if (importPw) headers['x-backup-password'] = importPw
      await fetch(`${BASE}/backup/import`, { method: 'POST', body: form, headers })
      closeModal(); window.location.reload()
    } catch { setImporting(false) }
    if (modalImportRef.current) modalImportRef.current.value = ''
  }


  async function handleDeleteProfile(id: string) {
    const res = await fetch(`${BASE}/users/${id}`, { method: 'DELETE' })
    if (res.ok) {
      const rem = users.filter(u => u.id !== id)
      setUsers(rem); closeModal()
      if (id === activeId && rem.length > 0) {
        setActiveUserId(rem[0].id); setActiveId(rem[0].id)
        window.location.reload()
      }
    }
  }

  const activeUser = users.find(u => u.id === activeId)
  const initial = (activeUser?.name ?? 'D').charAt(0).toUpperCase()

  return (
      <div className="relative mx-2 mb-4" ref={dropdownRef}>

        {/* ── Trigger ────────────────────────────────────────────────────── */}
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

        {/* ── Dropdown ── simple: switch / rename / new profile ────────── */}
        {open && (
          <div className="absolute bottom-full left-0 right-0 mb-2 bg-[var(--color-surface)]
            border border-[var(--color-border)] rounded-xl shadow-lg overflow-hidden z-50">

            <div className="max-h-64 overflow-y-auto py-1">
              {users.map(u => (
                <div key={u.id} className="group flex items-center gap-2 px-3 py-2
                  hover:bg-[var(--color-bg)] transition-colors">

                  {editingId === u.id ? (
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
                      <button onClick={e => { e.stopPropagation(); setEditingId(u.id); setEditingName(u.name) }}
                        className="p-1 rounded-md text-[var(--color-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-bg)]
                          opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                        title={t('common.edit')}>
                        <Pencil size={12} />
                      </button>
                      <button onClick={e => { e.stopPropagation(); openModal(u) }}
                        className="p-1 rounded-md text-[var(--color-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-bg)]
                          opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                        <MoreHorizontal size={13} />
                      </button>
                    </>
                  )}
                </div>
              ))}
            </div>

            {/* New profile */}
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

        {/* Hidden file input for new profile import */}
        <input ref={newImportRef} type="file" accept=".zip" className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) handleNewImportFile(f) }} />

        {/* ── Profile management panel ── inside dropdownRef so clicks don't close dropdown */}
        {modalUser && (
          <div
            className="fixed bottom-4 left-[232px] w-80 z-[100] bg-[var(--color-surface)]
              border border-[var(--color-border)] rounded-2xl shadow-2xl overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4
              border-b border-[var(--color-border)]">
              <div className="flex items-center gap-2.5">
                <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold
                  ${modalUser.id === activeId ? 'bg-[var(--color-accent)] text-white' : 'bg-[var(--color-accent)]/15 text-[var(--color-accent)]'}`}>
                  {modalUser.name.charAt(0).toUpperCase()}
                </span>
                <div>
                  <p className="text-sm font-semibold">{modalUser.name}</p>
                  {modalUser.id === activeId && (
                    <p className="text-xs text-[var(--color-accent)]">{t('userSwitcher.dataSection')}</p>
                  )}
                </div>
              </div>
              <button onClick={closeModal}
                className="p-1.5 rounded-lg text-[var(--color-muted)] hover:text-[var(--color-text)]
                  hover:bg-[var(--color-bg)] transition-colors">
                <X size={15} />
              </button>
            </div>

            <div className="divide-y divide-[var(--color-border)]">

              {/* Export section */}
              <div className="px-5 py-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Download size={14} className="text-[var(--color-muted)] shrink-0" />
                  <p className="text-sm font-medium">{t('userSwitcher.export')}</p>
                </div>
                <div className="space-y-2">
                  <label className="text-xs text-[var(--color-muted)]">
                    {t('settings.exportPassword')}
                  </label>
                  <input
                    type="password"
                    value={exportPw}
                    onChange={e => setExportPw(e.target.value)}
                    placeholder={t('settings.exportPasswordPlaceholder')}
                    className="w-full text-sm px-3 py-2 rounded-lg border border-[var(--color-border)]
                      bg-[var(--color-bg)] focus:outline-none focus:border-[var(--color-accent)]
                      placeholder:text-[var(--color-muted)]"
                  />
                </div>
                <button onClick={() => handleExport(modalUser.id)}
                  className="w-full flex items-center justify-center gap-2 py-2 text-sm font-medium
                    rounded-lg bg-[var(--color-accent)] text-white hover:opacity-90 transition-opacity">
                  <Download size={14} />
                  {t('userSwitcher.export')}
                </button>
              </div>

              {/* Import section */}
              <div className="px-5 py-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Upload size={14} className="text-[var(--color-muted)] shrink-0" />
                  <p className="text-sm font-medium">{t('userSwitcher.import')}</p>
                </div>
                <div className="space-y-2">
                  <label className="text-xs text-[var(--color-muted)]">
                    {t('settings.importPassword')}
                  </label>
                  <input
                    type="password"
                    value={importPw}
                    onChange={e => setImportPw(e.target.value)}
                    placeholder={t('settings.importPasswordPlaceholder')}
                    className="w-full text-sm px-3 py-2 rounded-lg border border-[var(--color-border)]
                      bg-[var(--color-bg)] focus:outline-none focus:border-[var(--color-accent)]
                      placeholder:text-[var(--color-muted)]"
                  />
                </div>
                <button onClick={() => modalImportRef.current?.click()} disabled={importing}
                  className="w-full flex items-center justify-center gap-2 py-2 text-sm font-medium
                    rounded-lg border border-[var(--color-border)] hover:border-[var(--color-accent)]
                    hover:text-[var(--color-accent)] disabled:opacity-50 transition-colors">
                  <Upload size={14} />
                  {importing ? t('userSwitcher.importing') : t('userSwitcher.import')}
                </button>
              </div>

              {/* Delete profile — available as long as there's more than one profile */}
              {users.length > 1 && (
                <div className="px-5 py-4">
                  {deleteConfirm ? (
                    /* Step 2: type profile name to confirm */
                    <div className="space-y-3">
                      <p className="text-xs text-[var(--color-muted)]">
                        {t('common.confirm')}：輸入&nbsp;
                        <code className="px-1.5 py-0.5 rounded bg-[var(--color-bg)]
                          border border-[var(--color-border)] font-mono text-[var(--color-text)] select-all">
                          {modalUser.name}
                        </code>
                      </p>
                      <input
                        autoFocus
                        value={deleteWord}
                        onChange={e => setDeleteWord(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Escape') { setDeleteConfirm(false); setDeleteWord('') }
                          if (e.key === 'Enter' && deleteWord === modalUser.name) handleDeleteProfile(modalUser.id)
                        }}
                        placeholder={t('userSwitcher.clearTypePlaceholder')}
                        className="w-full text-sm px-3 py-2 rounded-lg border border-[var(--color-border)]
                          focus:border-red-400 bg-[var(--color-bg)] focus:outline-none
                          placeholder:text-[var(--color-muted)]"
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <button onClick={() => handleDeleteProfile(modalUser.id)}
                          disabled={deleteWord !== modalUser.name}
                          className="py-2 text-sm font-medium rounded-lg
                            bg-red-500 text-white hover:opacity-90
                            disabled:opacity-30 transition-opacity">
                          {t('common.delete')}
                        </button>
                        <button onClick={() => { setDeleteConfirm(false); setDeleteWord('') }}
                          className="py-2 text-sm font-medium rounded-lg border border-[var(--color-border)]
                            hover:bg-[var(--color-bg)] transition-colors">
                          {t('common.cancel')}
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* Step 1: hold-to-arm animation */
                    <HoldDeleteButton
                      onConfirm={() => setDeleteConfirm(true)}
                      label={t('userSwitcher.deleteProfile')}
                      readyLabel={t('common.confirmDelete')}
                    />
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Hidden file input for modal import */}
        <input ref={modalImportRef} type="file" accept=".zip" className="hidden"
          onChange={e => {
            const f = e.target.files?.[0]
            if (f && modalUser) handleImportFile(f, modalUser.id)
          }} />
      </div>
  )
}
