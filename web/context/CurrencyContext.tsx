'use client'
import { createContext, useContext, useState, useEffect } from 'react'
import type { Currency } from '@/lib/types'

const STORAGE_KEY = 'displayCurrency'
const VALID: Currency[] = [
  'TWD', 'USD', 'JPY', 'EUR', 'GBP', 'CNY', 'HKD',
  'SGD', 'AUD', 'CAD', 'CHF', 'KRW', 'MYR', 'THB',
  'VND', 'IDR', 'PHP',
]

interface CurrencyCtx { currency: Currency; setCurrency: (c: Currency) => void }
const CurrencyContext = createContext<CurrencyCtx>({ currency: 'TWD', setCurrency: () => {} })

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const [currency, _setCurrency] = useState<Currency>('TWD')

  // Hydrate from localStorage after mount
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as Currency | null
    if (stored && VALID.includes(stored)) _setCurrency(stored)
  }, [])

  function setCurrency(c: Currency) {
    _setCurrency(c)
    localStorage.setItem(STORAGE_KEY, c)
  }

  return <CurrencyContext.Provider value={{ currency, setCurrency }}>{children}</CurrencyContext.Provider>
}

export const useCurrency = () => useContext(CurrencyContext)
