import React, { act } from 'react'
import { create, type ReactTestRenderer } from 'react-test-renderer'
import { Provider, createStore } from 'jotai'
import {
  TabCommandContext,
  tabCommandsAtom,
  useTabCommands,
  flattenMenuActions,
} from '../useTabCommands'
jest.mock('react-native', () => ({ Platform: { OS: 'web' } }))
it('preserves submenu labels, disabled parents and destructive actions; excludes hidden actions', () => {
  expect(
    flattenMenuActions([
      { id: 'hidden', title: 'Hidden', attributes: { hidden: true } },
      {
        title: 'Group',
        attributes: { disabled: true },
        subactions: [
          { id: 'child', title: 'Child' },
          { id: 'delete', title: 'Delete', attributes: { destructive: true } },
        ],
      },
    ])
  ).toEqual([
    { id: 'child', title: 'Group › Child', disabled: true, destructive: undefined },
    { id: 'delete', title: 'Group › Delete', disabled: true, destructive: true },
  ])
})

it('keeps cached tab commands isolated and uses the latest action handler', () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
  const store = createStore()
  const first = jest.fn()
  const latest = jest.fn()
  function Menu({ run }: { run: (id: string) => void }) {
    useTabCommands([{ id: 'settings', title: 'Settings' }], run)
    return null
  }
  const tree = (run: (id: string) => void) =>
    React.createElement(
      Provider,
      { store },
      React.createElement(
        TabCommandContext.Provider,
        { value: 'bible' },
        React.createElement(Menu, { run })
      ),
      React.createElement(
        TabCommandContext.Provider,
        { value: 'note' },
        React.createElement(Menu, { run: first })
      )
    )
  let renderer: ReactTestRenderer
  act(() => {
    renderer = create(tree(first))
  })
  act(() => {
    renderer!.update(tree(latest))
  })
  const entries = Object.values(store.get(tabCommandsAtom))
  expect(entries.map(entry => entry.tabId).sort()).toEqual(['bible', 'note'])
  entries.find(entry => entry.tabId === 'bible')!.commands[0].run()
  expect(latest).toHaveBeenCalledWith('settings')
  expect(first).not.toHaveBeenCalled()
  act(() => {
    renderer!.unmount()
  })
  expect(store.get(tabCommandsAtom)).toEqual({})
})
