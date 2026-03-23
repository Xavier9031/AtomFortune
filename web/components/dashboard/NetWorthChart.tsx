'use client'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import type { NetWorthHistory } from '@/lib/types'
import { formatValue } from '@/lib/utils'

export default function NetWorthChart({ data }: { data: NetWorthHistory }) {
  const fmt = ((v: number | string | undefined) => formatValue(Number(v ?? 0), data.displayCurrency)) as any
  return (
    <div data-testid="net-worth-chart" className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data.data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 11, fill: 'var(--color-muted)' }}
            tickFormatter={d => d.slice(5)}
          />
          <YAxis
            tick={{ fontSize: 11, fill: 'var(--color-muted)' }}
            tickFormatter={fmt}
            width={80}
          />
          <Tooltip formatter={fmt} labelStyle={{ color: 'var(--color-text)' }} />
          <Line
            type="monotone"
            dataKey="netWorth"
            stroke="var(--color-accent)"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
