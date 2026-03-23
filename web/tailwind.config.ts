import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg:              'var(--color-bg)',
        surface:         'var(--color-surface)',
        accent:          'var(--color-accent)',
        coral:           'var(--color-coral)',
        border:          'var(--color-border)',
        muted:           'var(--color-muted)',
        'cat-liquid':     'var(--cat-liquid)',
        'cat-investment': 'var(--cat-investment)',
        'cat-fixed':      'var(--cat-fixed)',
        'cat-receivable': 'var(--cat-receivable)',
        'cat-debt':       'var(--cat-debt)',
      },
    },
  },
  plugins: [],
}

export default config
