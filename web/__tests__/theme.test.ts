import fs from 'fs'
import path from 'path'

const css = fs.readFileSync(path.join(__dirname, '../app/globals.css'), 'utf-8')

const requiredVars = [
  '--color-bg', '--color-surface', '--color-accent', '--color-coral',
  '--cat-liquid', '--cat-investment', '--cat-fixed', '--cat-receivable', '--cat-debt',
]

test.each(requiredVars)('globals.css defines %s', (v) => {
  expect(css).toContain(v)
})
