export const SUPPORTED_CURRENCIES = [
  'TWD', 'USD', 'JPY', 'EUR', 'GBP', 'CNY', 'HKD',
  'SGD', 'AUD', 'CAD', 'CHF', 'KRW', 'MYR', 'THB',
  'VND', 'IDR', 'PHP',
] as const

export type SupportedCurrency = typeof SUPPORTED_CURRENCIES[number]
