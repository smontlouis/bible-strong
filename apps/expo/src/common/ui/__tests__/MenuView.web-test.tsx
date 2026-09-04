import React from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'

import { MenuView, type MenuComponentRef } from '../MenuView.web'

describe('MenuView on web', () => {
  let renderer: ReactTestRenderer

  beforeAll(() => {
    ;(
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true
  })

  afterEach(() => {
    act(() => renderer.unmount())
  })

  it('keeps its content visible without exposing a context menu', () => {
    const ref = React.createRef<MenuComponentRef>()
    const onOpenMenu = jest.fn()
    const onPressAction = jest.fn()

    act(() => {
      renderer = create(
        <MenuView
          ref={ref}
          actions={[{ id: 'copy', title: 'Copy' }]}
          onOpenMenu={onOpenMenu}
          onPressAction={onPressAction}
        >
          <span>Readable content</span>
        </MenuView>
      )
    })

    expect(renderer.root.findByType('span').props.children).toBe('Readable content')

    act(() => ref.current?.show())

    expect(onOpenMenu).not.toHaveBeenCalled()
    expect(onPressAction).not.toHaveBeenCalled()
  })
})
