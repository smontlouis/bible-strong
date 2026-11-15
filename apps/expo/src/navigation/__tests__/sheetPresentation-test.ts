import { isPageOverSheet } from '../sheetPresentation'

let mockOS = 'ios'
jest.mock('expo-router/build/react-navigation/core/NavigationContext', () => ({}))
jest.mock('expo-router/build/react-navigation/core/NavigationProvider', () => ({}))
jest.mock('react-native', () => ({
  Platform: {
    get OS() {
      return mockOS
    },
  },
}))

const stack = (...names: string[]) => names.map(name => ({ key: `${name}-key`, name }))

beforeEach(() => {
  mockOS = 'ios'
})

it('makes a page opened over a sheet a sheet', () => {
  expect(isPageOverSheet(stack('index', 'study-assistant', 'plan'), 2)).toBe(true)
  expect(isPageOverSheet(stack('index', '(explore)', 'timeline'), 2)).toBe(true)
})

it('keeps a page opened from a page a page', () => {
  expect(isPageOverSheet(stack('index', 'strobi'), 1)).toBe(false)
  expect(isPageOverSheet(stack('index', 'more', 'history'), 2)).toBe(false)
})

it('carries the sheet up through the pages above it', () => {
  expect(isPageOverSheet(stack('index', 'premium', 'login', 'register'), 3)).toBe(true)
})

it('leaves a declared sheet to its own options', () => {
  expect(isPageOverSheet(stack('index', 'study-assistant', 'premium'), 2)).toBe(false)
  expect(isPageOverSheet(stack('index'), 0)).toBe(false)
})

it('changes nothing on Android, where every route is a page', () => {
  mockOS = 'android'
  expect(isPageOverSheet(stack('index', 'study-assistant', 'plan'), 2)).toBe(false)
})
