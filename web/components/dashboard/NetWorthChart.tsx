'use client'
import { useState } from 'react'
import { useTranslations } from 'next-intl'
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, Legend,
} from 'recharts'
import { BASE } from '@/lib/api'
import { useNetWorthHistory, useCategoryHistory } from '@/lib/api'
import type { Currency } from '@/lib/types'

const CAT_COLOR: Record<string, string> = {
  liquid:     '#078080',
  investment: '#7c3aed',
  fixed:      '#1d4ed8',
  receivable: '#0ea5e9',
  debt:       '#f45d48',
}
const CATEGORIES = ['liquid', 'investment', 'fixed', 'receivable', 'debt']

type Range = '30d' | '1y' | 'all'
type Mode = 'netWorth' | 'category'

function fmtTick(v: number): string {
  const abs = Math.abs(v)
  if (abs >= 1e8) return (v / 1e8).toFixed(1) + 'B'
  if (abs >= 1e6) return (v / 1e6).toFixed(1) + 'M'
  if (abs >= 1e4) return (v / 1e4).toFixed(0) + 'W'
  return v.toFixed(0)
}

const tooltipStyle = {
  background: 'var(--color-surface)',
  border: '1px solid var(--color-border)',
  borderRadius: 8,
  fontSize: 12,
}

function TriggerButton() {
  const t = useTranslations('dashboard')
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  async function trigger() {
    setStatus('loading')
    try {
      await fetch(`${BASE.replace('/api/v1', '')}/snapshots/trigger`, { method: 'POST' })
      setStatus('done')
      setTimeout(() => window.location.reload(), 1000)
    } catch {
      setStatus('error')
    }
  }
  return (
    <button onClick={trigger} disabled={status === 'loading' || status === 'done'}
      className="px-4 py-2 bg-[var(--color-accent)] text-white rounded-lg text-sm disabled:opacity-60">
      {status === 'idle' && t('triggerSnapshot')}
      {status === 'loading' && t('triggeringSnapshot')}
      {status === 'done' && t('snapshotDone')}
      {status === 'error' && t('snapshotFailed')}
    </button>
  )
}

export default function NetWorthChart({ currency }: { currency: Currency }) {
  const t = useTranslations('dashboard')
  const tAsset = useTranslations('asset')
  const [range, setRange] = useState<Range>('30d')
  const [mode, setMode] = useState<Mode>('netWorth')

  const { data: nwData } = useNetWorthHistory(currency, range)
  const { data: catData } = useCategoryHistory(currency, range)

  const rangeLabels: Record<Range, string> = {
    '30d': t('range30d'),
    '1y':  t('range1y'),
    'all': t('rangeAll'),
  }

  const activeCats = CATEGORIES.filter(cat =>
    catData?.data.some(d => d[cat] != null)
  )

  const hasNwData = (nwData?.data.length ?? 0) > 0

  return (
    <div data-testid="net-worth-chart" className="space-y-3">
      {/* Mode + Range controls */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex gap-1 p-0.5 bg-[var(--color-bg)] rounded-lg">
          {(['netWorth', 'category'] as Mode[]).map(m => (
            <button key={m} onClick={() => setMode(m)}
              className={`px-3 py-1 text-xs rounded-md transition-colors
                ${mode === m
                  ? 'bg-[var(--color-surface)] shadow-sm font-semibold'
                  : 'text-[var(--color-muted)] hover:text-[var(--color-text)]'}`}>
              {m === 'netWorth' ? t('modeNetWorth') : t('modeCategory')}
            </button>
          ))}
        </div>
        <div className="flex gap-1">
          {(['30d', '1y', 'all'] as Range[]).map(r => (
            <button key={r} onClick={() => setRange(r)}
              className={`px-2.5 py-0.5 text-xs rounded-md transition-colors
                ${range === r
                  ? 'bg-[var(--color-accent)] text-white font-medium'
                  : 'text-[var(--color-muted)] hover:text-[var(--color-text)]'}`}>
              {rangeLabels[r]}
            </button>
          ))}
        </div>
      </div>

      {/* Chart or empty state */}
      {!hasNwData ? (
        <div className="flex items-center justify-center h-44 text-sm text-[var(--color-muted)] flex-col gap-3">
          <p>{t('noHistory')}</p>
          <TriggerButton />
        </div>
      ) : mode === 'netWorth' ? (
        <div className="h-52 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={nwData?.data ?? []} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--color-muted)' }} tickFormatter={d => d.slice(5)} />
              <YAxis tick={{ fontSize: 10, fill: 'var(--color-muted)' }} tickFormatter={fmtTick} width={56} />
              <Tooltip
                formatter={(v: any) => [fmtTick(Number(v)), t('modeNetWorth')]}
                labelStyle={{ color: 'var(--color-text)' }}
                contentStyle={tooltipStyle}
                itemStyle={{ color: 'var(--color-text)' }}
              />
              <Line type="monotone" dataKey="netWorth" stroke="var(--color-accent)"
                strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="h-52 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={catData?.data ?? []} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--color-muted)' }} tickFormatter={d => d.slice(5)} />
              <YAxis tick={{ fontSize: 10, fill: 'var(--color-muted)' }} tickFormatter={fmtTick} width={56} />
              <Tooltip
                formatter={(v: any, name: any) => [fmtTick(Number(v)), name]}
                labelStyle={{ color: 'var(--color-text)' }}
                contentStyle={tooltipStyle}
                itemStyle={{ color: 'var(--color-text)' }}
              />
              {activeCats.map(cat => (
                <Line key={cat} type="monotone" dataKey={cat}
                  name={tAsset(`categories.${cat}`)}
                  stroke={CAT_COLOR[cat]} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
              ))}
              <Legend wrapperStyle={{ fontSize: 11, paddingTop: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
