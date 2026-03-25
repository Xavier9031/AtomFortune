'use client'
import { useEffect } from 'react'
import { ensureActiveUserId } from '@/lib/user'

export default function ClientInit() {
  useEffect(() => {
    ensureActiveUserId()
  }, [])
  return null
}
