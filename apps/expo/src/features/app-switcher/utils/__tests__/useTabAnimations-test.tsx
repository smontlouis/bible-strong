import React, { act } from 'react'
import { create, type ReactTestRenderer } from 'react-test-renderer'
import { useTabAnimations } from '../useTabAnimations'

type Animation = { target: number; callback?: (finished: boolean) => void }

// Reanimated calls the cancelled animation's callback before detaching it.
// Preserve that ordering: a callback writing this same value must fail here too.
function mockShared(initial: number | string | null) {
  let value = initial
  let animation: Animation | null = null
  let setting = false
  return {
    get: () => value,
    set: (next: number | string | null | Animation) => {
      if (setting) throw new Error('Reentrant write from cancellation callback')
      setting = true
      try {
        animation?.callback?.(false)
        animation = null
        if (next !== null && typeof next === 'object') animation = next
        else value = next
      } finally {
        setting = false
      }
    },
    finish: () => {
      const current = animation
      animation = null
      if (current) {
        value = current.target
        current.callback?.(true)
      }
    },
  }
}
const mockSnapshot = jest.fn()
const mockSetAtom = jest.fn()
const mockResolve = jest.fn()
let mockContext: ReturnType<typeof makeContext>
function makeContext() {
  return {
    activeTabPreview: {
      index: mockShared(0),
      zIndex: mockShared(3),
      animationProgress: mockShared(0),
      left: mockShared(0),
      top: mockShared(0),
    },
    activeTabScreen: { opacity: mockShared(1), tabId: mockShared('tab-0') },
    tabPreviewCarousel: { opacity: mockShared(1), translateY: mockShared(0) },
  }
}
jest.mock('jotai/react', () => ({ useSetAtom: () => mockSetAtom }))
jest.mock('jotai/vanilla', () => ({ getDefaultStore: () => ({ set: mockSetAtom, get: () => 3 }) }))
jest.mock('~state/tabs', () => ({
  activeTabIndexAtom: 'index',
  appSwitcherModeAtom: 'mode',
  tabsCountAtom: 'count',
}))
jest.mock('../../AppSwitcherContext', () => ({ useAppSwitcherContext: () => mockContext }))
jest.mock('../useResponsiveWorkspace', () => ({ useResponsiveWorkspace: () => false }))
jest.mock('../useTabConstants', () => ({ __esModule: true, default: () => ({ HEIGHT: 900 }) }))
jest.mock('../useTakeActiveTabSnapshot', () => ({
  __esModule: true,
  default: () => ({ captureDeferredSnapshot: mockSnapshot }),
}))
jest.mock('../tabHelpers', () => ({
  resolveAndSetTabId: (...args: unknown[]) => mockResolve(...args),
  fadeInTabScreen: jest.fn(),
}))
jest.mock('react-native-worklets', () => ({ runOnJS: (fn: unknown) => fn }))
jest.mock('react-native-reanimated', () => ({
  Easing: { bezier: () => undefined },
  measure: jest.fn(),
  withTiming: (target: number, _config: unknown, callback?: Animation['callback']) => ({
    target,
    callback,
  }),
  withDelay: (_delay: number, animation: Animation) => animation,
}))

let animations: ReturnType<typeof useTabAnimations>
let tree: ReactTestRenderer
beforeEach(() => {
  jest.clearAllMocks()
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
  mockContext = makeContext()
  function Probe() {
    animations = useTabAnimations()
    return null
  }
  act(() => {
    tree = create(<Probe />)
  })
})
afterEach(() => act(() => tree.unmount()))

it('lets a newer tab switch cancel the carousel fade without recursive writes', () => {
  animations.slideToIndex(1)
  mockContext.activeTabPreview.index.finish()
  expect(() => animations.slideToIndex(2)).not.toThrow()
  expect(mockContext.tabPreviewCarousel.opacity.get()).toBe(1)
  expect(mockContext.tabPreviewCarousel.translateY.get()).toBe(0)
  expect(mockSnapshot).not.toHaveBeenCalled()
  mockContext.activeTabPreview.index.finish()
  mockContext.tabPreviewCarousel.opacity.finish()
  expect(mockContext.tabPreviewCarousel.opacity.get()).toBe(0)
  expect(mockContext.tabPreviewCarousel.translateY.get()).toBe(900)
  expect(mockResolve).toHaveBeenLastCalledWith(mockContext.activeTabScreen.tabId, 2)
  expect(mockSnapshot).toHaveBeenCalledTimes(1)
})
