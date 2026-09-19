import React, { act, createRef } from 'react'
import { create, type ReactTestRenderer } from 'react-test-renderer'
import Text from '../Text'
import type { Text as NativeText } from 'react-native'

jest.mock('react-native', () => ({
  Platform: { OS: 'web' },
  StyleSheet: { flatten: (style: unknown) => style },
  Text: 'Text',
}))
jest.mock('react-native-reanimated', () => ({
  __esModule: true,
  default: { createAnimatedComponent: (component: unknown) => component },
}))
jest.mock('~themes/ThemeProvider', () => ({
  useTheme: () => jest.requireActual('../../../../test/themeFixture').themeFixture,
}))

it('forwards merged classes, inline overrides and refs without resolving CSS', () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
  const ref = createRef<NativeText>()
  const nativeText = { measure: jest.fn() }
  const style = { fontSize: 30, color: 'red' }
  let renderer: ReactTestRenderer
  act(() => {
    renderer = create(
      <Text ref={ref} className="text-primary text-[24px] font-bold" style={style}>
        Test
      </Text>,
      { createNodeMock: () => nativeText }
    )
  })
  const props = renderer!.root.findByType('Text' as React.ElementType).props
  expect(props.className.split(' ')).toEqual(
    expect.arrayContaining(['text-primary', 'text-[24px]', 'font-bold'])
  )
  expect(props.className).not.toContain('text-default')
  expect(props.className).not.toContain('text-[16px]')
  expect(props.style).toEqual([
    style,
    { fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' },
  ])
  expect(ref.current).toBe(nativeText)
  act(() => renderer!.unmount())
})
