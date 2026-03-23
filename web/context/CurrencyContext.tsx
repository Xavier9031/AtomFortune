'use client'
import { createContext, useContext, useState } from 'react'
import type { Currency } from '@/lib/types'

interface CurrencyCtx { currency: Currency; setCurrency: (c: Currency) => void }
const CurrencyContext = createContext<CurrencyCtx>({ currency: 'TWD', setCurrency: () => {} })

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const [currency, setCurrency] = useState<Currency>('TWD')
  return <CurrencyContext.Provider value={{ currency, setCurrency }}>{children}</CurrencyContext.Provider>
}

export const useCurrency = () => useContext(CurrencyContext)
