import React, { act } from 'react'
import { create, type ReactTestRenderer } from 'react-test-renderer'
import ContextualPanel from '../index'
import type { PanelNavigation } from '../types'

let pendingAction: (() => void) | null = null
const mockDismissThen = jest.fn((action: () => void) => {
  pendingAction = action
})

jest.mock('~common/sheet', () => {
  const ReactModule = jest.requireActual<typeof React>('react')
  const Sheet = ReactModule.forwardRef(({ children }: React.PropsWithChildren, ref) => {
    ReactModule.useImperativeHandle(ref, () => ({
      present: jest.fn(),
      dismiss: jest.fn(),
      dismissThen: mockDismissThen,
    }))
    return ReactModule.createElement('Sheet', {}, children)
  })
  return {
    Sheet,
    SheetHeader: () => null,
    SheetScrollView: ({ children }: React.PropsWithChildren) => children,
  }
})
jest.mock('~common/ui/Box', () => ({ TouchableBox: 'TouchableBox' }))
jest.mock(
  '../PanelTransition',
  () =>
    ({ children }: React.PropsWithChildren) =>
      children
)

beforeAll(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
})

it('runs a closing action only once the native sheet has dismissed', () => {
  let navigation: PanelNavigation | undefined
  let view: ReactTestRenderer
  act(() => {
    view = create(
      <ContextualPanel
        accessibilityLabel="Options"
        trigger={null}
        initialScreen="actions"
        screens={{
          actions: {
            title: 'Actions',
            content: nav => {
              navigation = nav
              return null
            },
          },
        }}
      />
    )
  })
  act(() => view!.root.findByType('TouchableBox' as React.ElementType).props.onPress())

  const action = jest.fn()
  act(() => navigation!.closeThen(action))

  expect(mockDismissThen).toHaveBeenCalledTimes(1)
  expect(action).not.toHaveBeenCalled()

  act(() => pendingAction?.())
  expect(action).toHaveBeenCalledTimes(1)
  act(() => view!.unmount())
})
