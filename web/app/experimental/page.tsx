'use client'
import { useTranslations } from 'next-intl'
import { FlaskConical } from 'lucide-react'
import { useCurrency } from '@/context/CurrencyContext'
import { FireProgress, MonthlyDelta } from '@/components/dashboard/ExperimentalWidgets'

export default function ExperimentalPage() {
  const t = useTranslations()
  const { currency } = useCurrency()

  return (
    <main className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-2">
        <FlaskConical size={18} className="text-[var(--color-muted)]" />
        <h1 className="text-xl font-bold">{t('nav.experimental')}</h1>
      </div>
      <p className="text-sm text-[var(--color-muted)]">{t('settings.experimentalModeDesc')}</p>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <FireProgress currency={currency} />
        <MonthlyDelta currency={currency} />
      </div>
    </main>
  )
}
