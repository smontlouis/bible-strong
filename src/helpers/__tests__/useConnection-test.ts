import { connectionStatusFromNetInfo } from '../useConnection'

jest.mock('react-native', () => ({
  AppState: { currentState: 'active', addEventListener: jest.fn() },
  Platform: { OS: 'ios' },
}))

jest.mock('@react-native-community/netinfo', () => ({
  __esModule: true,
  default: { addEventListener: jest.fn(), fetch: jest.fn() },
}))

describe('connectionStatusFromNetInfo', () => {
  it('requires confirmed Internet reachability before reporting an Internet connection', () => {
    expect(connectionStatusFromNetInfo({ isConnected: true, isInternetReachable: false })).toBe(
      'offline'
    )
    expect(connectionStatusFromNetInfo({ isConnected: true, isInternetReachable: null })).toBe(
      'unknown'
    )
    expect(connectionStatusFromNetInfo({ isConnected: null, isInternetReachable: null })).toBe(
      'unknown'
    )
    expect(connectionStatusFromNetInfo({ isConnected: true, isInternetReachable: true })).toBe(
      'internet'
    )
  })
})
