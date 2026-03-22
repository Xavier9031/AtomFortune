import { formatValue, categoryColor } from '../lib/utils'

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
