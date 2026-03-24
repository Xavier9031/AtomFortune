'use client'
import { useState, useEffect, useRef } from 'react'
import { useTranslations } from 'next-intl'
import { ChevronDown, Plus, Check, Pencil, Trash2, Upload, X } from 'lucide-react'
import { BASE } from '@/lib/api'
import { getActiveUserId, setActiveUserId, fetchWithUser } from '@/lib/user'

type UserRecord = { id: string; name: string }

export default function UserSwitcher() {
  const t = useTranslations()
  const [open, setOpen] = useState(false)
  const [users, setUsers] = useState<UserRecord[]>([])
  const [activeId, setActiveId] = useState<string>('default-user')

  // new-profile flow: 'idle' → 'naming' → 'options' (empty | import)
  const [newName, setNewName] = useState('')
  const [newStep, setNewStep] = useState<'idle' | 'naming' | 'options'>('idle')
  const [importing, setImporting] = useState(false)

  // rename
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')

  // delete confirm
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const dropdownRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const nameInputRef = useRef<HTMLInputElement>(null)

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
    setNewStep('idle')
    setNewName('')
    setEditingId(null)
    setEditingName('')
    setDeletingId(null)
  }

  async function fetchUsers() {
    try {
      const res = await fetch(`${BASE}/users`)
      if (res.ok) setUsers(await res.json())
    } catch { /* silently fail */ }
  }

  function handleSwitch(id: string) {
    if (id === activeId) { closeDropdown(); return }
    setActiveUserId(id)
    setActiveId(id)
    closeDropdown()
    window.location.reload()
  }

  // ── New profile ──────────────────────────────────────────────────────────

  function handleNewProfileKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && newName.trim()) setNewStep('options')
    if (e.key === 'Escape') { setNewStep('idle'); setNewName('') }
  }

  async function createEmpty() {
    if (!newName.trim()) return
    try {
      const res = await fetch(`${BASE}/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim() }),
      })
      if (res.ok) {
        const user: UserRecord = await res.json()
        setUsers(prev => [...prev, user])
        setActiveUserId(user.id)
        setActiveId(user.id)
        closeDropdown()
        window.location.reload()
      }
    } catch {
      setNewStep('idle'); setNewName('')
    }
  }

  async function handleImportFile(file: File) {
    if (!newName.trim()) return
    setImporting(true)
    try {
      // 1. Create user
      const createRes = await fetch(`${BASE}/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim() }),
      })
      if (!createRes.ok) return
      const user: UserRecord = await createRes.json()

      // 2. Import backup into the new user
      const form = new FormData()
      form.append('file', file)
      await fetchWithUser(`${BASE}/backup/import`, {
        method: 'POST',
        headers: { 'x-user-id': user.id },
        body: form,
      })

      setUsers(prev => [...prev, user])
      setActiveUserId(user.id)
      setActiveId(user.id)
      closeDropdown()
      window.location.reload()
    } catch {
      setImporting(false)
      setNewStep('idle'); setNewName('')
    }
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
      setUsers(prev => prev.map(u => u.id === id ? updated : u))
      setEditingId(null)
      setEditingName('')
    }
  }

  // ── Delete ────────────────────────────────────────────────────────────────

  async function handleDelete(id: string) {
    const res = await fetchWithUser(`${BASE}/users/${id}`, { method: 'DELETE' })
    if (res.status === 204) {
      const remaining = users.filter(u => u.id !== id)
      setUsers(remaining)
      setDeletingId(null)
      if (id === activeId && remaining.length > 0) {
        setActiveUserId(remaining[0].id)
        setActiveId(remaining[0].id)
        closeDropdown()
        window.location.reload()
      }
    }
  }

  const activeUser = users.find(u => u.id === activeId)
  const initial = (activeUser?.name ?? 'D').charAt(0).toUpperCase()

  return (
    <div className="relative mx-2 mb-4" ref={dropdownRef}>
      {/* Trigger */}
      <button
        onClick={() => { setOpen(o => !o); if (open) closeDropdown() }}
        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg
          hover:bg-[var(--color-bg)] text-[var(--color-text)] text-sm transition-colors"
      >
        <span className="w-7 h-7 rounded-full bg-[var(--color-accent)] text-white flex items-center justify-center
          text-xs font-bold shrink-0">
          {initial}
        </span>
        <span className="flex-1 text-left truncate font-medium">
          {activeUser?.name ?? t('userSwitcher.defaultUser')}
        </span>
        <ChevronDown size={14} className={`shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute bottom-full left-0 right-0 mb-1 bg-[var(--color-surface)] border border-[var(--color-border)]
          rounded-xl shadow-lg overflow-hidden z-50 max-h-96 flex flex-col">

          {/* Profile list */}
          <div className="overflow-y-auto">
            {users.map(u => (
              <div key={u.id} className="group flex items-center gap-2 px-3 py-2.5 hover:bg-[var(--color-bg)] transition-colors">
                {editingId === u.id ? (
                  // Rename inline
                  <>
                    <span className="w-6 h-6 rounded-full bg-[var(--color-accent)]/20 text-[var(--color-accent)] flex items-center
                      justify-center text-xs font-bold shrink-0">
                      {u.name.charAt(0).toUpperCase()}
                    </span>
                    <input
                      autoFocus
                      value={editingName}
                      onChange={e => setEditingName(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') handleRename(u.id)
                        if (e.key === 'Escape') { setEditingId(null); setEditingName('') }
                      }}
                      className="flex-1 text-sm px-2 py-0.5 rounded border border-[var(--color-accent)] bg-[var(--color-bg)]
                        focus:outline-none"
                    />
                    <button onClick={() => handleRename(u.id)} className="p-1 text-[var(--color-accent)]">
                      <Check size={13} />
                    </button>
                    <button onClick={() => { setEditingId(null); setEditingName('') }} className="p-1 text-[var(--color-muted)]">
                      <X size={13} />
                    </button>
                  </>
                ) : deletingId === u.id ? (
                  // Delete confirm
                  <>
                    <span className="flex-1 text-xs text-[var(--color-coral)] truncate">
                      {t('userSwitcher.deleteConfirm', { name: u.name })}
                    </span>
                    <button onClick={() => handleDelete(u.id)}
                      className="text-xs px-2 py-0.5 rounded bg-[var(--color-coral)] text-white shrink-0">
                      {t('common.delete')}
                    </button>
                    <button onClick={() => setDeletingId(null)}
                      className="p-1 text-[var(--color-muted)]">
                      <X size={13} />
                    </button>
                  </>
                ) : (
                  // Normal row
                  <>
                    <button onClick={() => handleSwitch(u.id)} className="flex-1 flex items-center gap-2 min-w-0">
                      <span className="w-6 h-6 rounded-full bg-[var(--color-accent)]/20 text-[var(--color-accent)] flex items-center
                        justify-center text-xs font-bold shrink-0">
                        {u.name.charAt(0).toUpperCase()}
                      </span>
                      <span className="flex-1 truncate text-sm">{u.name}</span>
                      {u.id === activeId && <Check size={13} className="text-[var(--color-accent)] shrink-0" />}
                    </button>
                    {/* Action icons — shown on hover */}
                    <button
                      onClick={e => { e.stopPropagation(); setEditingId(u.id); setEditingName(u.name) }}
                      className="p-1 text-[var(--color-muted)] hover:text-[var(--color-text)]
                        opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                      <Pencil size={12} />
                    </button>
                    <button
                      onClick={e => { e.stopPropagation(); if (u.id !== activeId) setDeletingId(u.id) }}
                      disabled={u.id === activeId}
                      className="p-1 text-[var(--color-muted)] hover:text-[var(--color-coral)]
                        opacity-0 group-hover:opacity-100 transition-opacity shrink-0
                        disabled:opacity-0 disabled:cursor-not-allowed">
                      <Trash2 size={12} />
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>

          {/* New profile footer */}
          <div className="border-t border-[var(--color-border)] shrink-0">
            {newStep === 'idle' && (
              <button
                onClick={() => setNewStep('naming')}
                className="w-full flex items-center gap-2 px-3 py-2.5 text-sm
                  text-[var(--color-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-bg)] transition-colors">
                <Plus size={14} />
                {t('userSwitcher.newProfile')}
              </button>
            )}

            {newStep === 'naming' && (
              <div className="px-3 py-2 flex gap-2">
                <input
                  ref={nameInputRef}
                  autoFocus
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  onKeyDown={handleNewProfileKey}
                  placeholder={t('userSwitcher.newProfilePlaceholder')}
                  className="flex-1 text-sm px-2 py-1 rounded border border-[var(--color-border)] bg-[var(--color-bg)]
                    focus:outline-none focus:border-[var(--color-accent)] placeholder:text-[var(--color-muted)]"
                />
                <button
                  onClick={() => { if (newName.trim()) setNewStep('options') }}
                  disabled={!newName.trim()}
                  className="text-xs px-2 py-1 rounded bg-[var(--color-accent)] text-white disabled:opacity-40">
                  {t('common.next')}
                </button>
                <button onClick={() => { setNewStep('idle'); setNewName('') }}
                  className="p-1 text-[var(--color-muted)]">
                  <X size={14} />
                </button>
              </div>
            )}

            {newStep === 'options' && (
              <div className="px-3 py-2 space-y-1.5">
                <p className="text-xs text-[var(--color-muted)] truncate">
                  {t('userSwitcher.setupProfile', { name: newName })}
                </p>
                <div className="flex gap-2">
                  <button onClick={createEmpty}
                    className="flex-1 text-xs px-2 py-1.5 rounded border border-[var(--color-border)]
                      hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] transition-colors">
                    {t('userSwitcher.startEmpty')}
                  </button>
                  <button
                    onClick={() => fileRef.current?.click()}
                    disabled={importing}
                    className="flex-1 flex items-center justify-center gap-1 text-xs px-2 py-1.5 rounded
                      bg-[var(--color-accent)] text-white disabled:opacity-50 transition-opacity">
                    <Upload size={11} />
                    {importing ? t('userSwitcher.importing') : t('userSwitcher.importBackup')}
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

      {/* Hidden file input for import */}
      <input
        ref={fileRef}
        type="file"
        accept=".zip"
        className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) handleImportFile(f) }}
      />
    </div>
  )
}
