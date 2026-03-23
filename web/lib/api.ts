import useSWR from 'swr'
import type { Currency, DashboardSummary, AllocationData, NetWorthHistory, CategoryHistory, LiveDashboard } from './types'

export const BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8000/api/v1'
export const fetcher = (url: string) =>
  fetch(url).then(r => { if (!r.ok) throw new Error(r.statusText); return r.json() })

export const useDashboardSummary = (currency: Currency) =>
  useSWR<DashboardSummary>(`${BASE}/dashboard/summary?displayCurrency=${currency}`, fetcher)

export const useAllocation = (currency: Currency, date?: string) =>
  useSWR<AllocationData>(
    `${BASE}/dashboard/allocation?displayCurrency=${currency}${date ? `&date=${date}` : ''}`,
    fetcher
  )

export const useNetWorthHistory = (currency: Currency, range = '30d') =>
  useSWR<NetWorthHistory>(
    `${BASE}/dashboard/net-worth-history?range=${range}&displayCurrency=${currency}`,
    fetcher,
    { keepPreviousData: true }
  )

export const useCategoryHistory = (currency: Currency, range = '30d') =>
  useSWR<CategoryHistory>(
    `${BASE}/dashboard/category-history?range=${range}&displayCurrency=${currency}`,
    fetcher,
    { keepPreviousData: true }
  )

export const useLiveDashboard = (currency: Currency) =>
  useSWR<LiveDashboard>(
    `${BASE}/dashboard/live?displayCurrency=${currency}`,
    fetcher,
    { keepPreviousData: true }
  )
