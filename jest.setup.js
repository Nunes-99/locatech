import "@testing-library/jest-dom"

// Mock fetch for tests
global.fetch = jest.fn()

// Reset mocks between tests
beforeEach(() => {
  jest.clearAllMocks()
})
