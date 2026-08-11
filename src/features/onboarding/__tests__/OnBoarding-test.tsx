import React from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'

import OnBoarding from '../OnBoarding'

const mockGetIfVersionNeedsDownload = jest.fn(async () => true)
const mockDeleteAllDatabases = jest.fn()
const mockDispatch = jest.fn()

jest.mock('react-native', () => {
  const React = jest.requireActual<typeof import('react')>('react')
  return {
    Modal: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) =>
      React.createElement('Modal', { ...props, testID: 'onboarding-modal' }, children),
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

jest.mock('~helpers/sqlite', () => ({
  deleteAllDatabases: () => mockDeleteAllDatabases(),
}))

jest.mock('~helpers/useLanguage', () => () => 'fr')
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

  it('hands Abel off to real resource selection and only closes after setup completion', async () => {
    let renderer: ReactTestRenderer
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined)
    const consoleLog = jest.spyOn(console, 'log').mockImplementation(() => undefined)

    try {
      await act(async () => {
        renderer = create(<OnBoarding />)
      })

      expect(renderer!.root.findByProps({ testID: 'onboarding-modal' }).props.visible).toBe(true)
      const abel = renderer!.root.findByProps({ testID: 'abel-onboarding' })

      act(() => abel.props.onComplete())

      expect(renderer!.root.findAllByProps({ testID: 'abel-onboarding' })).toHaveLength(0)
      const resources = renderer!.root.findByProps({ testID: 'select-resources' })
      expect(renderer!.root.findByProps({ testID: 'onboarding-modal' }).props.visible).toBe(true)

      await act(async () => resources.props.onComplete())

      expect(renderer!.root.findByProps({ testID: 'onboarding-modal' }).props.visible).toBe(false)
    } finally {
      consoleError.mockRestore()
      consoleLog.mockRestore()
    }
  })
})
