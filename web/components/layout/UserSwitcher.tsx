'use client'
import { useState, useEffect, useRef } from 'react'
import { useTranslations } from 'next-intl'
import { ChevronDown, Plus, Check } from 'lucide-react'
import { BASE } from '@/lib/api'
import { getActiveUserId, setActiveUserId } from '@/lib/user'

type UserRecord = { id: string; name: string }

export default function UserSwitcher() {
  const t = useTranslations()
  const [open, setOpen] = useState(false)
  const [users, setUsers] = useState<UserRecord[]>([])
  const [activeId, setActiveId] = useState<string>('default-user')
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setActiveId(getActiveUserId())
    fetchUsers()
  }, [])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false)
        setCreating(false)
        setNewName('')
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  async function fetchUsers() {
    try {
      const res = await fetch(`${BASE}/users`)
      if (res.ok) setUsers(await res.json())
    } catch { /* silently fail */ }
  }

  function handleSwitch(id: string) {
    setActiveUserId(id)
    setActiveId(id)
    setOpen(false)
    window.location.reload()
  }

  async function handleCreate() {
    if (!newName.trim()) return
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
      setCreating(false)
      setNewName('')
      setOpen(false)
      window.location.reload()
    }
  }

  const activeUser = users.find(u => u.id === activeId)
  const initial = (activeUser?.name ?? 'D').charAt(0).toUpperCase()

  return (
    <div className="relative mx-2 mb-4" ref={dropdownRef}>
      <button
        onClick={() => setOpen(o => !o)}
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

      {open && (
        <div className="absolute bottom-full left-0 right-0 mb-1 bg-[var(--color-surface)] border border-[var(--color-border)]
          rounded-xl shadow-lg overflow-hidden z-50">
          {users.map(u => (
            <button
              key={u.id}
              onClick={() => handleSwitch(u.id)}
              className="w-full flex items-center gap-2 px-3 py-2.5 text-sm
                hover:bg-[var(--color-bg)] transition-colors text-left"
            >
              <span className="w-6 h-6 rounded-full bg-[var(--color-accent)]/20 text-[var(--color-accent)] flex items-center
                justify-center text-xs font-bold shrink-0">
                {u.name.charAt(0).toUpperCase()}
              </span>
              <span className="flex-1 truncate">{u.name}</span>
              {u.id === activeId && <Check size={14} className="text-[var(--color-accent)] shrink-0" />}
            </button>
          ))}

          <div className="border-t border-[var(--color-border)]">
            {creating ? (
              <div className="px-3 py-2 flex gap-2">
                <input
                  autoFocus
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleCreate(); if (e.key === 'Escape') { setCreating(false); setNewName('') } }}
                  placeholder={t('userSwitcher.newProfilePlaceholder')}
                  className="flex-1 text-sm px-2 py-1 rounded border border-[var(--color-border)] bg-[var(--color-bg)]
                    focus:outline-none focus:border-[var(--color-accent)] placeholder:text-[var(--color-muted)]"
                />
                <button
                  onClick={handleCreate}
                  disabled={!newName.trim()}
                  className="text-xs px-2 py-1 rounded bg-[var(--color-accent)] text-white disabled:opacity-50"
                >
                  {t('common.create')}
                </button>
              </div>
            ) : (
              <button
                onClick={() => setCreating(true)}
                className="w-full flex items-center gap-2 px-3 py-2.5 text-sm
                  text-[var(--color-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-bg)] transition-colors"
              >
                <Plus size={14} />
                {t('userSwitcher.newProfile')}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
