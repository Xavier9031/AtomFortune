import type { Config } from 'jest'

const config: Config = {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  modulePathIgnorePatterns: ['<rootDir>/.next/'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
    '^next/navigation$': '<rootDir>/__mocks__/next-navigation.ts',
    '^next/link$': '<rootDir>/__mocks__/next-link.tsx',
    '^next-intl$': '<rootDir>/__mocks__/next-intl.tsx',
  },
  transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest', {
      tsconfig: { jsx: 'react-jsx' },
    }],
  },
}

export default config
