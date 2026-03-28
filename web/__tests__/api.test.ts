import { categoryColor, formatValue, getDefaultUnitForSubKind, getDisplayUnit } from '../lib/utils'

test('formatValue formats TWD with no decimals', () => {
  expect(formatValue(12847320, 'TWD')).toBe('NT$12,847,320')
})
test('formatValue formats USD with 2 decimals', () => {
  expect(formatValue(1234.5, 'USD')).toBe('$1,234.50')
})
test('categoryColor returns CSS var for known category', () => {
  expect(categoryColor('investment')).toBe('var(--cat-investment)')
})
test('categoryColor returns fallback for unknown', () => {
  expect(categoryColor('unknown')).toBe('var(--color-muted)')
})

test('getDefaultUnitForSubKind returns currency for liquid assets', () => {
  expect(getDefaultUnitForSubKind({ subKind: 'physical_cash', currencyCode: 'TWD' })).toBe('TWD')
})

test('getDefaultUnitForSubKind returns ticker symbol for crypto assets', () => {
  expect(getDefaultUnitForSubKind({ subKind: 'crypto', currencyCode: 'USD', symbol: 'btc' })).toBe('BTC')
})

test('getDisplayUnit ignores bad stored units for liquid assets', () => {
  expect(getDisplayUnit({
    subKind: 'physical_cash',
    unit: 'gram',
    currencyCode: 'TWD',
  })).toBe('TWD')
})
