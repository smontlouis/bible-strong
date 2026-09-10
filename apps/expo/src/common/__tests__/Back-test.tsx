import React from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import { TouchableOpacity } from 'react-native'
import Back from '../Back'

const mockRouter = { canGoBack: jest.fn(), back: jest.fn(), replace: jest.fn() }
const mockParent = { getState: jest.fn(), getParent: jest.fn() }
const mockNavigation = { getState: jest.fn(), getParent: jest.fn() }
const mockTransition = jest.fn((_path: string, navigate: () => void) => navigate())
jest.mock('expo-router', () => ({
  useRouter: () => mockRouter,
  useNavigation: () => mockNavigation,
}))
jest.mock('~navigation/pageTransition', () => ({
  navigateWithPageTransition: (...args: [string, () => void]) => mockTransition(...args),
}))
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }))

jest.mock('react-native', () => {
  const ReactModule = jest.requireActual<typeof React>('react')
  return {
    TouchableOpacity: (props: Record<string, unknown>) =>
      ReactModule.createElement('TouchableOpacity', props),
    StyleSheet: { flatten: (style: unknown) => style },
  }
})

let tree: ReactTestRenderer
beforeEach(() => {
  jest.clearAllMocks()
  mockRouter.canGoBack.mockReturnValue(false)
  mockNavigation.getState.mockReturnValue({ index: 0, routes: [{ name: 'nave-detail' }] })
  mockNavigation.getParent.mockReturnValue(undefined)
})
afterEach(() => {
  act(() => tree?.unmount())
})
const press = (props: React.ComponentProps<typeof Back> = {}) => {
  act(() => {
    tree = create(<Back {...props} />)
  })
  act(() => tree.root.findByType(TouchableOpacity).props.onPress())
}

it('replaces a direct-entry detail with root instead of dispatching an unhandled back', () => {
  const onGoBack = jest.fn()
  press({ onGoBack })
  expect(mockRouter.back).not.toHaveBeenCalled()
  expect(mockRouter.replace).toHaveBeenCalledWith('/')
  expect(mockTransition.mock.calls[0][0]).toBe('/')
  expect(onGoBack).toHaveBeenCalledTimes(1)
})

it('keeps normal back navigation including history in a parent navigator', () => {
  mockRouter.canGoBack.mockReturnValue(true)
  mockNavigation.getParent.mockReturnValue(mockParent)
  mockParent.getState.mockReturnValue({ index: 1, routes: [{ name: 'nave' }, { name: 'explore' }] })
  press()
  expect(mockRouter.back).toHaveBeenCalledTimes(1)
  expect(mockRouter.replace).not.toHaveBeenCalled()
  expect(mockTransition.mock.calls[0][0]).toBe('/nave')
})

it('preserves custom tab-local back actions', () => {
  const onCustomPress = jest.fn()
  press({ onCustomPress })
  expect(onCustomPress).toHaveBeenCalledTimes(1)
  expect(mockRouter.back).not.toHaveBeenCalled()
  expect(mockRouter.replace).not.toHaveBeenCalled()
})
