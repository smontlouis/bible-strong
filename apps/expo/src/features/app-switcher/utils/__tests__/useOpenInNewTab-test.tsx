import React, { act } from 'react'
import { create, type ReactTestRenderer } from 'react-test-renderer'
import { useOpenInNewTab } from '../useOpenInNewTab'
import { toast } from '~helpers/toast'

const mockAdd = jest.fn()
const mockSwitch = jest.fn()
const mockDismiss = jest.fn()
const mockSlide = jest.fn()
jest.mock('expo-router', () => ({ useRouter: () => ({ dismissTo: mockDismiss }) }))
jest.mock('jotai/react', () => ({ useSetAtom: () => mockAdd }))
jest.mock('~state/tabGroups', () => ({
  addTabToGroupAtom: 'add',
  useSwitchGroup: () => mockSwitch,
}))
jest.mock('~state/tabs', () => ({ DEFAULT_GROUP_ID: 'default-group' }))
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }))
jest.mock('~helpers/generateUUID', () => ({ __esModule: true, default: () => '123' }))
jest.mock('~helpers/toast', () => ({ toast: Object.assign(jest.fn(), { dismiss: jest.fn() }) }))
jest.mock('../useSlideNewTab', () => ({
  useSlideNewTab: () => ({ triggerSlideNewTab: mockSlide }),
}))

it('inserts into the default group and only switches when opening the created tab', () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
  let open: ReturnType<typeof useOpenInNewTab>
  function Probe() {
    open = useOpenInNewTab()
    return null
  }
  let view: ReactTestRenderer
  act(() => {
    view = create(<Probe />)
  })
  act(() => open(undefined, { autoRedirect: true }))
  expect(mockAdd).toHaveBeenLastCalledWith(
    expect.objectContaining({
      groupId: 'default-group',
      tab: expect.objectContaining({ id: 'new-123', type: 'new' }),
    })
  )
  expect(mockSwitch).toHaveBeenLastCalledWith('default-group')
  expect(mockSlide).toHaveBeenLastCalledWith('new-123')
  mockSwitch.mockClear()
  mockSlide.mockClear()
  act(() =>
    open({ id: 'existing-resource', title: 'Resource', type: 'new', isRemovable: true, data: {} })
  )
  expect(mockAdd).toHaveBeenLastCalledWith(
    expect.objectContaining({
      groupId: 'default-group',
      tab: expect.objectContaining({ id: 'existing-resource' }),
    })
  )
  expect(mockSwitch).not.toHaveBeenCalled()
  const options = jest.mocked(toast).mock.calls.at(-1)?.[1]
  const action = options?.action
  if (!action || typeof action !== 'object' || !('onClick' in action)) {
    throw new Error('Expected a toast action to open the created tab')
  }
  act(() => action.onClick())
  expect(mockSwitch).toHaveBeenLastCalledWith('default-group')
  expect(mockSlide).toHaveBeenLastCalledWith('existing-resource')
  act(() => view!.unmount())
})
