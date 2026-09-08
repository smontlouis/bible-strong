/* eslint-disable import/no-duplicates -- Exercise both platform adapters. */
import React, { act } from 'react'
import { create, type ReactTestRenderer } from 'react-test-renderer'
import NativeMenu from '../ContextualMenu'
import WebMenu from '../ContextualMenu.web'

jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }))
jest.mock('~common/ui/MenuView', () => ({ MenuView: 'NativeMenu' }), { virtual: true })
jest.mock('../index', () => ({ __esModule: true, default: 'Panel' }))
jest.mock('../PanelAction', () => ({ __esModule: true, default: 'Action' }))

it('navigates nested web actions without invoking the former sheet launcher', () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
  const launch = jest.fn()
  const navigation = { open: jest.fn(), back: jest.fn(), close: jest.fn() }
  let panel: ReactTestRenderer
  let content: ReactTestRenderer
  act(() => {
    panel = create(
      <WebMenu
        panelTitle="Plan"
        panelWidth={500}
        actions={[
          { id: 'version', title: 'Version' },
          { id: 'share', title: 'Partager' },
        ]}
        screens={{ version: { title: 'Version', content: () => null } }}
        onPressAction={launch}
      >
        <span>Menu</span>
      </WebMenu>
    )
  })
  const props = panel!.root.findByType('Panel' as React.ElementType).props
  expect(props.width).toBeUndefined()
  expect(props.screens['menu-actions'].width).toBeUndefined()
  expect(props.screens.version.width).toBe(500)
  act(() => {
    content = create(props.screens['menu-actions'].content(navigation))
  })
  const actions = content!.root.findAllByType('Action' as React.ElementType)
  expect(actions[0].props.nested).toBe(true)
  act(() => actions[0].props.onPress())
  expect(navigation.open).toHaveBeenCalledWith('version')
  expect(navigation.close).not.toHaveBeenCalled()
  expect(launch).not.toHaveBeenCalled()
  act(() => actions[1].props.onPress())
  expect(navigation.close).toHaveBeenCalledTimes(1)
  expect(launch).toHaveBeenCalledWith({ nativeEvent: { event: 'share' } })
  act(() => {
    panel!.unmount()
    content!.unmount()
  })
})

it('keeps the native menu actions and sheet callbacks intact', () => {
  const launch = jest.fn()
  const actions = [{ id: 'format', title: 'Mise en forme' }]
  let view: ReactTestRenderer
  act(() => {
    view = create(
      <NativeMenu
        panelTitle="Plan"
        actions={actions}
        onPressAction={launch}
        screens={{ format: { title: 'Format', content: () => null } }}
      >
        <span>Menu</span>
      </NativeMenu>
    )
  })
  const menu = view!.root.findByType('NativeMenu' as React.ElementType)
  expect(menu.props.actions).toBe(actions)
  expect(menu.props.onPressAction).toBe(launch)
  expect(menu.props.screens).toBeUndefined()
  act(() => view!.unmount())
})
