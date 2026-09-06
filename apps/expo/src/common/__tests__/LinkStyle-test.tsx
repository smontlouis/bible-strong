import React from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import Link from '../Link'

jest.mock('react-native', () => ({
  TouchableOpacity: 'TouchableOpacity',
  StyleSheet: jest.requireActual('react-native-web/dist/cjs/exports/StyleSheet'),
}))
jest.mock('expo-router', () => ({ useRouter: () => ({}) }))
jest.mock('~navigation/usePushRouteOnce', () => ({ usePushRouteOnce: () => jest.fn() }))
jest.mock('~navigation/routeMapping', () => ({ routeMapping: {} }))
jest.mock('~common/ui/Box', () => ({ __esModule: true, default: 'Box' }))

it('accepts nested native style arrays without emitting numeric DOM style properties', () => {
  ;(
    globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true
  let renderer!: ReactTestRenderer
  act(() => {
    renderer = create(
      <Link style={[{ padding: 4 }, [{ height: 24 }, false], { padding: 8 }]}>Open</Link>
    )
  })
  expect(renderer.root.findByType('TouchableOpacity' as React.ElementType).props.style).toEqual({
    padding: 8,
    height: 24,
  })
  act(() => renderer.unmount())
})
