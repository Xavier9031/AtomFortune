import type { ReactNode } from 'react'

const messages = require('../messages/zh-TW.json')

function getMessage(path: string): string | null {
  let current: any = messages
  for (const key of path.split('.')) {
    current = current?.[key]
    if (current == null) return null
  }
  return typeof current === 'string' ? current : null
}

export function NextIntlClientProvider({ children }: { children: ReactNode }) {
  return children
}

export function useLocale() {
  return 'zh-TW'
}

export function useTranslations(namespace?: string) {
  return (key: string, values?: Record<string, unknown> & { defaultValue?: string }) => {
    const path = namespace ? `${namespace}.${key}` : key
    const template = getMessage(path) ?? values?.defaultValue ?? key
    return Object.entries(values ?? {}).reduce((text, [name, value]) => {
      if (name === 'defaultValue') return text
      return text.replaceAll(`{${name}}`, String(value))
    }, template)
  }
}
