import React from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import { MenuView, type MenuComponentRef } from '../MenuView.web'

jest.mock('../MenuView.web.css', () => ({}))
jest.mock('react-native', () => ({ View: 'View' }))
jest.mock('@expo/vector-icons/Feather', () => 'MenuIcon')
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }))
jest.mock('~themes/ThemeProvider', () => ({
  useTheme: () => jest.requireActual('../../../../test/themeFixture').themeFixture,
}))
// Adapter contract tests; browser QA exercises HeroUI's actual focus/portal behavior.
jest.mock(
  '@heroui/react/dropdown',
  () => {
    const ReactModule = jest.requireActual<typeof React>('react')
    const component =
      (name: string) =>
      ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) =>
        ReactModule.createElement(name, props, children)
    return {
      Dropdown: Object.assign(component('HeroDropdown'), {
        Trigger: component('HeroTrigger'),
        Popover: component('HeroPopover'),
        Menu: component('HeroMenu'),
        Item: component('HeroItem'),
        SubmenuTrigger: component('HeroSubmenu'),
        SubmenuIndicator: component('HeroChevron'),
        Section: component('HeroSection'),
      }),
    }
  },
  { virtual: true }
)
jest.mock('@heroui/react/label', () => ({ Label: 'label' }), { virtual: true })
jest.mock('@heroui/react/header', () => ({ Header: 'header' }), { virtual: true })

const host = (renderer: ReactTestRenderer, name: string) =>
  renderer.root.findByType(name as React.ElementType)

describe('MenuView on web', () => {
  let renderer: ReactTestRenderer
  beforeAll(() => {
    ;(
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true
  })
  afterEach(() => act(() => renderer.unmount()))

  it('opens by trigger or public handle and delivers the native action event once', () => {
    const ref = React.createRef<MenuComponentRef>()
    const onOpenMenu = jest.fn(),
      onCloseMenu = jest.fn(),
      onPressAction = jest.fn()
    act(() => {
      renderer = create(
        <MenuView
          ref={ref}
          accessibilityLabel="Bible options"
          actions={[{ id: 'params', title: 'Settings' }]}
          onOpenMenu={onOpenMenu}
          onCloseMenu={onCloseMenu}
          onPressAction={onPressAction}
        >
          <span>Three dots</span>
        </MenuView>
      )
    })
    expect(host(renderer, 'HeroTrigger').props['aria-label']).toBe('Bible options')
    act(() => ref.current?.show())
    expect(host(renderer, 'HeroDropdown').props.isOpen).toBe(true)
    expect(onOpenMenu).toHaveBeenCalledTimes(1)
    act(() => ref.current?.show())
    expect(onOpenMenu).toHaveBeenCalledTimes(1)
    act(() => host(renderer, 'HeroItem').props.onAction())
    expect(onPressAction).toHaveBeenCalledWith({ nativeEvent: { event: 'params' } })
    expect(onCloseMenu).toHaveBeenCalledTimes(1)
    expect(host(renderer, 'HeroDropdown').props.isOpen).toBe(false)
    act(() => host(renderer, 'HeroDropdown').props.onOpenChange(true))
    act(() => host(renderer, 'HeroDropdown').props.onOpenChange(false))
    expect(onOpenMenu).toHaveBeenCalledTimes(2)
    expect(onCloseMenu).toHaveBeenCalledTimes(2)
  })

  it('preserves submenus, inline groups, checked state, disabled and destructive actions', () => {
    const onPressAction = jest.fn()
    act(() => {
      renderer = create(
        <MenuView
          onPressAction={onPressAction}
          actions={[
            { title: 'Hidden', attributes: { hidden: true } },
            { title: 'Group', subactions: [{ title: 'Checked', state: 'on' }] },
            {
              title: 'Inline',
              displayInline: true,
              attributes: { disabled: true },
              subactions: [{ title: 'Disabled' }],
            },
            { id: 'remove', title: 'Delete', attributes: { destructive: true } },
          ]}
        >
          <span>Menu</span>
        </MenuView>
      )
    })
    const items = renderer.root.findAllByType('HeroItem' as React.ElementType)
    expect(items.map(item => item.props.textValue)).toEqual([
      'Group',
      'Checked',
      'Disabled',
      'Delete',
    ])
    expect(items[1].props['data-checked']).toBe(true)
    expect(items[2].props.isDisabled).toBe(true)
    expect(items[3].props.variant).toBe('danger')
    expect(
      renderer.root
        .findAllByType('HeroSection' as React.ElementType)
        .some(section => section.props['aria-label'] === 'Inline')
    ).toBe(true)
    act(() => items[2].props.onAction())
    expect(onPressAction).not.toHaveBeenCalled()
    act(() => items[1].props.onAction())
    expect(onPressAction).toHaveBeenCalledWith({ nativeEvent: { event: 'Checked' } })
  })

  it('does not open an empty menu and passes the long-press mode to HeroUI', () => {
    const ref = React.createRef<MenuComponentRef>(),
      onOpenMenu = jest.fn()
    act(() => {
      renderer = create(
        <MenuView
          ref={ref}
          actions={[{ title: 'Hidden', attributes: { hidden: true } }]}
          onOpenMenu={onOpenMenu}
          shouldOpenOnLongPress
        >
          <span>Content</span>
        </MenuView>
      )
    })
    expect(host(renderer, 'HeroDropdown').props.trigger).toBe('longPress')
    expect(host(renderer, 'HeroTrigger').props.isDisabled).toBe(true)
    act(() => ref.current?.show())
    expect(onOpenMenu).not.toHaveBeenCalled()
  })
})
