import { onlineManager } from '@tanstack/react-query'
import type { NetInfoState } from '@react-native-community/netinfo'
import { configureQueryManagers, queryClient } from '../queryClient'

let mockNetInfoListener: ((state: Partial<NetInfoState>) => void) | undefined

jest.mock('../runtimeConfig', () => ({ isOfflineModeForced: false }))

jest.mock('react-native', () => ({
  AppState: { addEventListener: jest.fn(() => ({ remove: jest.fn() })) },
  Platform: { OS: 'ios' },
}))

jest.mock('@react-native-community/netinfo', () => ({
  __esModule: true,
  default: {
    addEventListener: jest.fn((listener: (state: Partial<NetInfoState>) => void) => {
      mockNetInfoListener = listener
      return jest.fn()
    }),
    fetch: jest.fn(),
  },
}))

const emit = (isConnected: boolean, isInternetReachable: boolean | null) =>
  mockNetInfoListener?.({ isConnected, isInternetReachable })

describe('configureQueryManagers', () => {
  it('stays online on an unvalidated network and refetches failures once Internet returns', () => {
    const onOnline = jest.spyOn(queryClient.getQueryCache(), 'onOnline')
    configureQueryManagers()

    emit(true, false)
    expect(onlineManager.isOnline()).toBe(true)
    expect(onOnline).not.toHaveBeenCalled()

    emit(true, true)
    expect(onOnline).toHaveBeenCalledTimes(1)

    emit(false, false)
    expect(onlineManager.isOnline()).toBe(false)

    // A real reconnection already notifies React Query through the online state.
    onOnline.mockClear()
    emit(true, true)
    expect(onlineManager.isOnline()).toBe(true)
    expect(onOnline).not.toHaveBeenCalled()
  })
})
