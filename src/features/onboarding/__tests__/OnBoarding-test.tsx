import React from 'react'
import { getDefaultStore } from 'jotai/vanilla'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'

import { isOnboardingCompletedAtom } from '../atom'
import OnBoarding from '../OnBoarding'

const mockGetIfVersionNeedsDownload = jest.fn(async () => true)
const mockDeleteAllDatabases = jest.fn()
const mockDispatch = jest.fn()
let mockIsOnboardingForced = false
let mockLanguage = 'fr'

jest.mock('react-native', () => {
  const React = jest.requireActual<typeof import('react')>('react')
  return {
    Modal: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) =>
      React.createElement('Modal', { ...props, testID: 'onboarding-modal' }, children),
  }
})

jest.mock('react-native-gesture-handler', () => {
  const React = jest.requireActual<typeof import('react')>('react')
  return {
    GestureHandlerRootView: ({
      children,
      ...props
    }: React.PropsWithChildren<Record<string, unknown>>) =>
      React.createElement('GestureHandlerRootView', { ...props, testID: 'gesture-root' }, children),
  }
})

jest.mock('jotai/react', () => jest.requireActual('jotai/react'))

jest.mock('../atom', () => {
  const { atom } = jest.requireActual<typeof import('jotai/vanilla')>('jotai/vanilla')
  return {
    isOnboardingCompletedAtom: atom(false),
  }
})

jest.mock('~common/ui/Box', () => {
  const React = jest.requireActual<typeof import('react')>('react')
  return ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) =>
    React.createElement('Box', props, children)
})

jest.mock('~helpers/bibleVersions', () => ({
  getIfVersionNeedsDownload: () => mockGetIfVersionNeedsDownload(),
}))

jest.mock('~helpers/languageUtils', () => ({
  getDefaultBibleVersion: () => 'LSG',
}))

jest.mock('~helpers/runtimeConfig', () => ({
  get isOnboardingForced() {
    return mockIsOnboardingForced
  },
}))

jest.mock('~helpers/sqlite', () => ({
  deleteAllDatabases: () => mockDeleteAllDatabases(),
}))

jest.mock('~helpers/useLanguage', () => () => mockLanguage)
jest.mock('~redux/modules/user', () => ({ setDefaultBibleVersion: (version: string) => version }))
jest.mock('react-redux', () => ({ useDispatch: () => mockDispatch }))

jest.mock('../AbelOnboarding', () => {
  const React = jest.requireActual<typeof import('react')>('react')
  return (props: Record<string, unknown>) =>
    React.createElement('AbelOnboarding', { ...props, testID: 'abel-onboarding' })
})

jest.mock('../SelectResources', () => {
  const React = jest.requireActual<typeof import('react')>('react')
  return (props: Record<string, unknown>) =>
    React.createElement('SelectResources', { ...props, testID: 'select-resources' })
})

describe('OnBoarding', () => {
  beforeAll(() => {
    ;(
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true
  })

  beforeEach(() => {
    mockIsOnboardingForced = false
    mockLanguage = 'fr'
    mockDeleteAllDatabases.mockClear()
    mockGetIfVersionNeedsDownload.mockClear()
    getDefaultStore().set(isOnboardingCompletedAtom, false)
  })

  it('hands Abel off to real resource selection and only closes after setup completion', async () => {
    let renderer: ReactTestRenderer | undefined
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined)
    const consoleLog = jest.spyOn(console, 'log').mockImplementation(() => undefined)

    try {
      await act(async () => {
        renderer = create(<OnBoarding />)
      })

      expect(renderer!.root.findByProps({ testID: 'onboarding-modal' }).props.visible).toBe(true)
      expect(renderer!.root.findByProps({ testID: 'gesture-root' }).props.style).toEqual({
        flex: 1,
      })
      const abel = renderer!.root.findByProps({ testID: 'abel-onboarding' })

      act(() => abel.props.onComplete())

      expect(renderer!.root.findAllByProps({ testID: 'abel-onboarding' })).toHaveLength(0)
      const resources = renderer!.root.findByProps({ testID: 'select-resources' })
      expect(renderer!.root.findByProps({ testID: 'onboarding-modal' }).props.visible).toBe(true)

      await act(async () => resources.props.onComplete())

      expect(renderer!.root.findByProps({ testID: 'onboarding-modal' }).props.visible).toBe(false)
    } finally {
      act(() => renderer?.unmount())
      consoleError.mockRestore()
      consoleLog.mockRestore()
    }
  })

  it('replays forced onboarding per mount while still closing the completed session', async () => {
    mockIsOnboardingForced = true
    getDefaultStore().set(isOnboardingCompletedAtom, true)
    let renderer: ReactTestRenderer
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined)

    try {
      await act(async () => {
        renderer = create(<OnBoarding />)
      })

      act(() => renderer!.root.findByProps({ testID: 'abel-onboarding' }).props.onComplete())
      const resources = renderer!.root.findByProps({ testID: 'select-resources' })
      await act(async () => resources.props.onComplete())
      expect(renderer!.root.findByProps({ testID: 'onboarding-modal' }).props.visible).toBe(false)
      expect(getDefaultStore().get(isOnboardingCompletedAtom)).toBe(true)
      expect(mockDeleteAllDatabases).not.toHaveBeenCalled()
      expect(mockGetIfVersionNeedsDownload).not.toHaveBeenCalled()

      mockLanguage = 'en'
      await act(async () => renderer!.update(<OnBoarding />))
      expect(renderer!.root.findByProps({ testID: 'onboarding-modal' }).props.visible).toBe(false)

      act(() => renderer!.unmount())
      await act(async () => {
        renderer = create(<OnBoarding />)
      })

      expect(renderer!.root.findByProps({ testID: 'onboarding-modal' }).props.visible).toBe(true)
    } finally {
      act(() => renderer?.unmount())
      consoleError.mockRestore()
    }
  })
})
