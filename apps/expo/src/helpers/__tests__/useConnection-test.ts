import { connectionStatusFromNetInfo, isOfflineFailureFromNetInfo } from '../useConnection'

jest.mock('../runtimeConfig', () => ({ isOfflineModeForced: false }))

jest.mock('react-native', () => ({
  AppState: { currentState: 'active', addEventListener: jest.fn() },
  Platform: { OS: 'ios' },
}))

jest.mock('@react-native-community/netinfo', () => ({
  __esModule: true,
  default: { addEventListener: jest.fn(), fetch: jest.fn() },
}))

describe('connectionStatusFromNetInfo', () => {
  it('tries the network whenever a connection exists, even with unvalidated reachability', () => {
    // Android reports a working network as unreachable when its connectivity probe is blocked.
    expect(connectionStatusFromNetInfo({ isConnected: true, isInternetReachable: false })).toBe(
      'internet'
    )
    expect(connectionStatusFromNetInfo({ isConnected: true, isInternetReachable: null })).toBe(
      'internet'
    )
    expect(connectionStatusFromNetInfo({ isConnected: true, isInternetReachable: true })).toBe(
      'internet'
    )
  })

  it('reports offline only without a connection, and unknown before NetInfo knows', () => {
    expect(connectionStatusFromNetInfo({ isConnected: false, isInternetReachable: null })).toBe(
      'offline'
    )
    expect(connectionStatusFromNetInfo({ isConnected: null, isInternetReachable: null })).toBe(
      'unknown'
    )
  })

  it('can force the effective connection status offline', () => {
    expect(
      connectionStatusFromNetInfo({ isConnected: true, isInternetReachable: true }, true)
    ).toBe('offline')
  })
})

describe('isOfflineFailureFromNetInfo', () => {
  it('explains a failed request by a lost connection or unvalidated reachability', () => {
    expect(isOfflineFailureFromNetInfo({ isConnected: false, isInternetReachable: null })).toBe(
      true
    )
    expect(isOfflineFailureFromNetInfo({ isConnected: true, isInternetReachable: false })).toBe(
      true
    )
    expect(isOfflineFailureFromNetInfo({ isConnected: true, isInternetReachable: null })).toBe(
      false
    )
    expect(isOfflineFailureFromNetInfo({ isConnected: true, isInternetReachable: true })).toBe(
      false
    )
    expect(
      isOfflineFailureFromNetInfo({ isConnected: true, isInternetReachable: true }, true)
    ).toBe(true)
  })
})
