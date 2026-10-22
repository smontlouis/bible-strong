import { onlineManager } from '@tanstack/react-query'
import type { NetInfoState } from '@react-native-community/netinfo'
import { configureQueryManagers, queryClient } from '../queryClient'
import { resourceQueryKeys } from '../resourceQueryKeys'
import { refetchResourceOnReconnect, retryUnlessRefused } from '../resourceQueryRecovery'

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

describe('resource query defaults', () => {
  it('keeps resource reads for the session and leaves refused requests to the reader', () => {
    const defaults = queryClient.defaultQueryOptions({
      queryKey: resourceQueryKeys.bibleReferences('1-1-1'),
    })
    expect(defaults.staleTime).toBe(Infinity)
    expect(defaults.refetchOnWindowFocus).toBe(refetchResourceOnReconnect)
    expect(defaults.retry).toBe(retryUnlessRefused)
    // User data keeps the library's freshness rules.
    const userDefaults = queryClient.defaultQueryOptions({ queryKey: ['events', 'fr'] })
    expect(userDefaults.staleTime).toBeUndefined()
    expect(userDefaults.refetchOnWindowFocus).toBeUndefined()
  })
})
