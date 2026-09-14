import React from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import ReminderSettings from '../ReminderSettings'
import type { ReadingReminderPermissionApi } from '../useReadingReminderPermission'

jest.mock('@expo/ui/community/datetime-picker', () => ({ DateTimePicker: 'DateTimePicker' }))
jest.mock('react-native', () => ({
  Platform: { OS: 'ios' },
  ActivityIndicator: 'ActivityIndicator',
}))
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'fr' } }),
}))
jest.mock('~common/Link', () => 'Link')
jest.mock('~common/ui/Box', () => 'Box')
jest.mock('~common/ui/Text', () => 'Text')
jest.mock('~common/ui/Icon', () => ({ FeatherIcon: 'Icon' }))
jest.mock('~common/ui/Switch', () => 'Switch')
jest.mock('../useReadingReminderPermission', () => ({
  useReadingReminderPermission: () => ({ ...mockPermission }),
}))

const mockPermission: ReadingReminderPermissionApi = {
  permission: 'not-requested',
  phase: 'idle',
  through: {},
  request: jest.fn(async () => true),
  openSettings: jest.fn(async () => {}),
  retry: jest.fn(),
}
let renderer: ReactTestRenderer | undefined
const change = jest.fn()
const mount = (time?: string) => {
  act(() => {
    renderer = create(<ReminderSettings time={time} onChange={change} />)
  })
}
const toggle = (enabled: boolean) =>
  renderer!.root.find(node => String(node.type) === 'Switch').props.onValueChange(enabled)

beforeAll(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
})
beforeEach(() => {
  jest.clearAllMocks()
  mockPermission.permission = 'not-requested'
  mockPermission.phase = 'idle'
  mockPermission.through = {}
  jest.mocked(mockPermission.request).mockResolvedValue(true)
})
afterEach(() => {
  if (renderer) act(() => renderer!.unmount())
  renderer = undefined
})

describe('reminder settings', () => {
  it('does not request device permission just by opening the settings', () => {
    mount()
    expect(mockPermission.request).not.toHaveBeenCalled()
    expect(change).not.toHaveBeenCalled()
  })

  it('only enables after the explicit request is allowed', async () => {
    mount()
    await act(async () => {
      await toggle(true)
    })
    expect(mockPermission.request).toHaveBeenCalledTimes(1)
    expect(change).toHaveBeenCalledWith('07:00')
  })

  it('does not promise a reminder after a refused permission', async () => {
    jest.mocked(mockPermission.request).mockImplementation(async () => {
      mockPermission.permission = 'denied'
      return false
    })
    mount()
    await act(async () => {
      await toggle(true)
    })
    expect(change).not.toHaveBeenCalled()
    // The permission hook publishes its device state independently of the switch value.
    act(() => renderer!.update(<ReminderSettings onChange={change} />))
    expect(
      renderer!.root.findAll(node => String(node.type) === 'Text').map(node => node.props.children)
    ).toContain('dailyReading.permissionDenied')
  })

  it('can disable without asking permission again', async () => {
    mount('08:30')
    await act(async () => {
      await toggle(false)
    })
    expect(mockPermission.request).not.toHaveBeenCalled()
    expect(change).toHaveBeenCalledWith(null)
  })

  it('does not apply a permission result after leaving the settings', async () => {
    let finish!: (allowed: boolean) => void
    jest.mocked(mockPermission.request).mockReturnValueOnce(
      new Promise(resolve => {
        finish = resolve
      })
    )
    mount()
    let pending!: Promise<void>
    act(() => {
      pending = toggle(true)
    })
    act(() => renderer!.unmount())
    renderer = undefined
    await act(async () => {
      finish(true)
      await pending
    })
    expect(change).not.toHaveBeenCalled()
  })
})
