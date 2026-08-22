import { useEffect, useRef, useState } from 'react'
import { AppState, AppStateStatus, Platform } from 'react-native'
import NetInfo, { NetInfoState } from '@react-native-community/netinfo'
import { isOfflineModeForced } from './runtimeConfig'

export type ConnectionStatus = 'unknown' | 'offline' | 'internet'

export const connectionStatusFromNetInfo = (
  state: Pick<NetInfoState, 'isConnected' | 'isInternetReachable'>,
  forceOffline = isOfflineModeForced
): ConnectionStatus => {
  if (forceOffline) return 'offline'
  if (state.isConnected === false || state.isInternetReachable === false) return 'offline'
  if (state.isConnected === true && state.isInternetReachable === true) return 'internet'
  return 'unknown'
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
