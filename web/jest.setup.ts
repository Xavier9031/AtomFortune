import '@testing-library/jest-dom'

global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

// Provide a default fetch mock so components that call fetch() don't crash in jsdom
if (typeof global.fetch === 'undefined') {
  global.fetch = jest.fn(() =>
    Promise.resolve({ ok: true, json: () => Promise.resolve({}) } as Response)
  )
}
