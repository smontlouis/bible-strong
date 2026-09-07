import { finishPageTransition, navigateWithPageTransition } from '../pageTransition.web'

let mockPathname = '/home'

jest.mock('expo-router/build/global-state/router-store', () => ({
  store: { getRouteInfo: () => ({ pathname: mockPathname }) },
}))

const style = { viewTransitionName: '', removeProperty: jest.fn() }
let update: (() => Promise<void>) | undefined
const start = jest.fn((callback: () => Promise<void>) => {
  update = callback
  return { skipTransition: jest.fn(), finished: Promise.resolve() }
})

beforeEach(() => {
  mockPathname = '/home'
  jest.clearAllMocks()
  update = undefined
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: {
      startViewTransition: start,
      documentElement: { dataset: {} },
      querySelector: () => ({ style }),
      querySelectorAll: () => [{ style, getBoundingClientRect: () => ({ width: 550 }) }],
    },
  })
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      matchMedia: () => ({ matches: false }),
      setTimeout,
      clearTimeout,
    },
  })
})

it('waits for the route render before finishing the snapshot update', async () => {
  const navigate = jest.fn()
  navigateWithPageTransition('/(library)/passage-media', navigate)
  expect(start).toHaveBeenCalledTimes(1)
  const pending = update!()
  expect(navigate).toHaveBeenCalledTimes(1)
  finishPageTransition()
  await pending
})
it('keeps form sheets outside page transitions', () => {
  const navigate = jest.fn()
  navigateWithPageTransition('/note', navigate)
  expect(start).not.toHaveBeenCalled()
  expect(navigate).toHaveBeenCalledTimes(1)
})
it('navigates normally when the browser has no view transitions', () => {
  Object.defineProperty(document, 'startViewTransition', { value: undefined })
  const navigate = jest.fn()
  navigateWithPageTransition('/plans', navigate)
  expect(navigate).toHaveBeenCalledTimes(1)
})

it('marks back navigation for the inverse animation', () => {
  navigateWithPageTransition('/home', jest.fn(), 'back')
  expect(document.documentElement.dataset.pageTransitionDirection).toBe('back')
})

it('animates navigation inside the panel with its own snapshot target', async () => {
  mockPathname = '/note'
  navigateWithPageTransition('/entity-relations', jest.fn())
  expect(document.documentElement.dataset.panelViewTransition).toBe('true')
  expect(start).toHaveBeenCalledTimes(1)
  const pending = update!()
  finishPageTransition()
  await pending
})
it('does not animate panel closure as a page transition', () => {
  mockPathname = '/note'
  navigateWithPageTransition('/home', jest.fn(), 'back')
  expect(start).not.toHaveBeenCalled()
})
