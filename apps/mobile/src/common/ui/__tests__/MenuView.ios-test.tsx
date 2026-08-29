import React from 'react'
import { View } from 'react-native'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'

import { MenuView } from '../MenuView.ios'

jest.mock('react-native', () => {
  const ReactModule = jest.requireActual<typeof React>('react')

  return {
    View: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) =>
      ReactModule.createElement('View', props, children),
  }
})

jest.mock('@expo/ui', () => ({
  Icon: {
    select: ({ ios }: { ios: string }) => ios,
  },
}))

jest.mock('@expo/ui/community/menu', () => {
  const ReactModule = jest.requireActual<typeof React>('react')

  return {
    MenuView: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) =>
      ReactModule.createElement('ExpoMenuView', props, children),
  }
})

describe('MenuView on iOS', () => {
  let renderer: ReactTestRenderer
  let consoleError: jest.SpyInstance

  beforeEach(() => {
    ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
    consoleError = jest.spyOn(console, 'error').mockImplementation(message => {
      if (typeof message === 'string' && message.startsWith('react-test-renderer is deprecated')) {
        return
      }
    })
  })

  afterEach(() => {
    act(() => renderer?.unmount())
    consoleError.mockRestore()
  })

  it('keeps the trigger as the direct native-menu child while adding accessibility metadata', () => {
    act(() => {
      renderer = create(
        <MenuView accessibilityLabel="Options bibliques" actions={[]}>
          <View testID="menu-trigger" style={{ width: 40, height: 40 }} />
        </MenuView>
      )
    })

    const nativeMenu = renderer.root.find(node => String(node.type) === 'ExpoMenuView')
    const trigger = nativeMenu.children[0]

    expect(typeof trigger).not.toBe('string')
    if (typeof trigger === 'string') throw new Error('Expected a React trigger element')

    expect(trigger.props).toEqual(
      expect.objectContaining({
        testID: 'menu-trigger',
        accessible: true,
        accessibilityRole: 'button',
        accessibilityLabel: 'Options bibliques',
      })
    )
  })
})
