'use client'
import { useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Smartphone, Loader2 } from 'lucide-react'
import QRCode from 'qrcode'
import { BASE } from '@/lib/api'

type Status = 'idle' | 'starting' | 'active' | 'error'

export default function QRCodeCard() {
  const t = useTranslations('settings')
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [status, setStatus] = useState<Status>('idle')
  const [url, setUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Check if tunnel is already running on mount
  useEffect(() => {
    fetch(`${BASE}/tunnel/status`)
      .then(r => r.json())
      .then(data => {
        if (data.active && data.url) {
          setUrl(data.url)
          setStatus('active')
        }
      })
      .catch(() => {})
  }, [])

  // Render QR code whenever URL changes
  useEffect(() => {
    if (!url || !canvasRef.current) return
    const dark = document.documentElement.dataset.theme === 'dark'
    QRCode.toCanvas(canvasRef.current, url, {
      width: 200,
      margin: 2,
      color: {
        dark: dark ? '#f8f5f2' : '#232323',
        light: dark ? '#232320' : '#fffffe',
      },
    })
  }, [url])

  async function handleStart() {
    setStatus('starting')
    setError(null)
    try {
      const res = await fetch(`${BASE}/tunnel/start`, { method: 'POST' })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setUrl(data.url)
      setStatus('active')
    } catch (err: any) {
      setError(err.message)
      setStatus('error')
    }
  }

  async function handleStop() {
    await fetch(`${BASE}/tunnel/stop`, { method: 'POST' }).catch(() => {})
    setUrl(null)
    setStatus('idle')
  }

  return (
    <section className="bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] overflow-hidden">
      <div className="px-5 py-3 border-b border-[var(--color-border)]">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
          {t('sectionRemoteAccess')}
        </h2>
      </div>
      <div className="px-5 py-5 flex flex-col items-center gap-4">

        {status === 'idle' && (
          <>
            <div className="flex items-center gap-2 text-[var(--color-muted)]">
              <Smartphone size={16} />
              <p className="text-xs">{t('remoteAccessDesc')}</p>
            </div>
            <button
              onClick={handleStart}
              className="px-5 py-2 rounded-lg bg-[var(--color-accent)] text-white text-sm font-medium hover:opacity-90 transition-opacity">
              {t('startTunnel')}
            </button>
          </>
        )}

        {status === 'starting' && (
          <div className="flex flex-col items-center gap-3 py-4">
            <Loader2 size={24} className="animate-spin text-[var(--color-accent)]" />
            <p className="text-sm text-[var(--color-muted)]">{t('tunnelStarting')}</p>
          </div>
        )}

        {status === 'active' && url && (
          <>
            <canvas ref={canvasRef} className="rounded-lg" />
            <p className="text-xs text-[var(--color-accent)] break-all text-center max-w-xs">{url}</p>
            <button
              onClick={handleStop}
              className="px-5 py-2 rounded-lg border border-[var(--color-border)] text-sm font-medium text-[var(--color-muted)] hover:bg-[var(--color-bg)] transition-colors">
              {t('stopTunnel')}
            </button>
          </>
        )}

        {status === 'error' && (
          <div className="flex flex-col items-center gap-3">
            <p className="text-xs text-[var(--color-coral)] text-center">{error}</p>
            <button
              onClick={handleStart}
              className="px-5 py-2 rounded-lg bg-[var(--color-accent)] text-white text-sm font-medium hover:opacity-90 transition-opacity">
              {t('retryTunnel')}
            </button>
          </div>
        )}

      </div>
    </section>
  )
}
