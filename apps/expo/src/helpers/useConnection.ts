import { useEffect, useRef, useState } from 'react'
import { AppState, AppStateStatus, Platform } from 'react-native'
import NetInfo, { NetInfoState } from '@react-native-community/netinfo'
import { isOfflineModeForced } from './runtimeConfig'

export type ConnectionStatus = 'unknown' | 'offline' | 'internet'

type NetInfoConnection = Pick<NetInfoState, 'isConnected' | 'isInternetReachable'>

/**
 * Whether a request is worth trying. Only a missing network counts as offline: Android reports an
 * unvalidated network as unreachable when its connectivity probe is blocked (private DNS, some
 * VPNs) although requests go through (#406), so reachability never blocks a request.
 */
export const connectionStatusFromNetInfo = (
  state: NetInfoConnection,
  forceOffline = isOfflineModeForced
): ConnectionStatus => {
  if (forceOffline || state.isConnected === false) return 'offline'
  if (state.isConnected === true) return 'internet'
  return 'unknown'
}

/** Whether a request that failed without a response should be explained by a lost connection. */
export const isOfflineFailureFromNetInfo = (
  state: NetInfoConnection,
  forceOffline = isOfflineModeForced
): boolean => forceOffline || state.isConnected === false || state.isInternetReachable === false

export const isLikelyOfflineAfterFailure = async (): Promise<boolean> => {
  if (isOfflineModeForced) return true
  try {
    return isOfflineFailureFromNetInfo(await NetInfo.fetch())
  } catch {
    return false
  }
}

export const useConnectionStatus = (): ConnectionStatus => {
  const [status, setStatus] = useState<ConnectionStatus>(
    isOfflineModeForced ? 'offline' : 'unknown'
  )
  const appStateRef = useRef(AppState.currentState)

  useEffect(() => {
    if (isOfflineModeForced) return

    let unsubscribeNetInfo: (() => void) | null = null

    const updateStatus = (state: NetInfoState) => {
      setStatus(connectionStatusFromNetInfo(state))
    }
    const subscribe = () => {
      if (!unsubscribeNetInfo) {
        unsubscribeNetInfo = NetInfo.addEventListener(updateStatus)
      }
    }
    const unsubscribe = () => {
      unsubscribeNetInfo?.()
      unsubscribeNetInfo = null
    }

    subscribe()

    if (Platform.OS === 'android') {
      const handleAppStateChange = (nextAppState: AppStateStatus) => {
        if (appStateRef.current === 'active' && nextAppState.match(/inactive|background/)) {
          unsubscribe()
        } else if (appStateRef.current.match(/inactive|background/) && nextAppState === 'active') {
          subscribe()
          NetInfo.fetch().then(updateStatus)
        }
        appStateRef.current = nextAppState
      }

      const subscription = AppState.addEventListener('change', handleAppStateChange)

      return () => {
        subscription.remove()
        unsubscribe()
      }
    }

    return unsubscribe
  }, [])

  return status
}

const useConnection = () => useConnectionStatus() === 'internet'

export default useConnection
