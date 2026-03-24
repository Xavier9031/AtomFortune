import { describe, it, expect } from 'vitest'
import { existsSync } from 'fs'
import { resolve } from 'path'

describe('monorepo scaffold', () => {
  it('api/src/index.ts exists', () => {
    expect(existsSync(resolve(__dirname, '../src/index.ts'))).toBe(true)
  })
  it('shared/types.ts exists', () => {
    expect(existsSync(resolve(__dirname, '../../shared/types.ts'))).toBe(true)
  })
})
