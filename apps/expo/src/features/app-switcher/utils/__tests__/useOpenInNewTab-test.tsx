import React, { act } from 'react'
import { create, type ReactTestRenderer } from 'react-test-renderer'
import { useOpenInNewTab } from '../useOpenInNewTab'
import { toast } from '~helpers/toast'

let mockPanelOpen = false
let mockActiveGroupId = 'default-group'
beforeEach(() => {
  jest.clearAllMocks()
  mockPanelOpen = false
  mockActiveGroupId = 'current-group'
})
jest.mock('~navigation/useWorkspaceRoutePanel', () => ({
  useWorkspaceRoutePanel: () => ({ open: mockPanelOpen }),
}))
const mockAdd = jest.fn()
const mockSwitch = jest.fn()
const mockDismiss = jest.fn()
const mockPush = jest.fn()
const mockSlide = jest.fn()
jest.mock('expo-router', () => ({
  useRouter: () => ({ dismissTo: mockDismiss, push: mockPush }),
}))
jest.mock('jotai/react', () => ({
  useSetAtom: () => mockAdd,
  useStore: () => ({ get: () => mockActiveGroupId }),
}))
jest.mock('~state/tabGroups', () => ({
  addTabToGroupAtom: 'add',
  useSwitchGroup: () => mockSwitch,
}))
jest.mock('~state/tabs', () => ({
  DEFAULT_GROUP_ID: 'default-group',
  activeGroupIdAtom: 'active-group',
}))
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }))
jest.mock('~helpers/generateUUID', () => ({ __esModule: true, default: () => '123' }))
jest.mock('~helpers/toast', () => ({ toast: Object.assign(jest.fn(), { dismiss: jest.fn() }) }))
jest.mock('../useSlideNewTab', () => ({
  useSlideNewTab: () => ({ triggerSlideNewTab: mockSlide }),
}))

it('inserts into the group active at invocation and only switches when opening the created tab', () => {
  mockActiveGroupId = 'group-at-render'
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
  mockActiveGroupId = 'current-group'
  act(() => open(undefined, { autoRedirect: true }))
  expect(mockAdd).toHaveBeenLastCalledWith(
    expect.objectContaining({
      groupId: 'current-group',
      tab: expect.objectContaining({ id: 'new-123', type: 'new' }),
    })
  )
  expect(mockSwitch).toHaveBeenLastCalledWith('current-group')
  expect(mockSlide).toHaveBeenLastCalledWith('new-123')
  mockSwitch.mockClear()
  mockSlide.mockClear()
  act(() =>
    open({ id: 'existing-resource', title: 'Resource', type: 'new', isRemovable: true, data: {} })
  )
  expect(mockAdd).toHaveBeenLastCalledWith(
    expect.objectContaining({
      groupId: 'current-group',
      tab: expect.objectContaining({ id: 'existing-resource' }),
    })
  )
  expect(mockSwitch).not.toHaveBeenCalled()
  const options = jest.mocked(toast).mock.calls.at(-1)?.[1]
  const action = options?.action
  if (!action || typeof action !== 'object' || !('onClick' in action)) {
    throw new Error('Expected a toast action to open the created tab')
  }
  mockActiveGroupId = 'another-group'
  act(() => action.onClick())
  expect(mockSwitch).toHaveBeenLastCalledWith('current-group')
  expect(mockSlide).toHaveBeenLastCalledWith('existing-resource')
  act(() => view!.unmount())
})

it('opens a tab created from a web side panel immediately and dismisses the panel', () => {
  jest.clearAllMocks()
  mockPanelOpen = true
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
  act(() => open({ id: 'from-panel', title: 'Resource', type: 'new', isRemovable: true, data: {} }))
  expect(mockAdd).toHaveBeenCalled()
  expect(mockDismiss).toHaveBeenCalledWith('/')
  expect(mockSwitch).toHaveBeenCalledWith('current-group')
  expect(mockSlide).toHaveBeenCalledWith('from-panel')
  expect(toast).not.toHaveBeenCalled()
  act(() => view!.unmount())
  mockPanelOpen = false
})

it('creates and opens a tab in the explicitly requested group', () => {
  jest.clearAllMocks()
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
  let open!: ReturnType<typeof useOpenInNewTab>
  function Probe() {
    open = useOpenInNewTab()
    return null
  }
  let view!: ReactTestRenderer
  act(() => {
    view = create(<Probe />)
  })
  act(() => open(undefined, { autoRedirect: true, groupId: 'clicked-group' }))
  expect(mockAdd).toHaveBeenCalledWith(expect.objectContaining({ groupId: 'clicked-group' }))
  expect(mockSwitch).toHaveBeenCalledWith('clicked-group')
  expect(mockDismiss).toHaveBeenCalledWith('/')
  expect(mockSlide).toHaveBeenCalledWith('new-123')
  act(() => view.unmount())
})

it('can push the workspace root when opening from a public page', () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
  let open!: ReturnType<typeof useOpenInNewTab>
  function Probe() {
    open = useOpenInNewTab()
    return null
  }
  let view!: ReactTestRenderer
  act(() => {
    view = create(<Probe />)
  })
  act(() =>
    open(
      { id: 'public-bible', title: 'Genèse 3:3', type: 'new', isRemovable: true, data: {} },
      { autoRedirect: true, navigation: 'push' }
    )
  )
  expect(mockPush).toHaveBeenCalledWith('/')
  expect(mockDismiss).not.toHaveBeenCalled()
  expect(mockSlide).toHaveBeenCalledWith('public-bible')
  act(() => view.unmount())
})
