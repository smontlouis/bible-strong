import { useEffect, useState, useRef, useCallback } from 'react'
import { AppState, AppStateStatus, Platform } from 'react-native'
import NetInfo, { NetInfoState } from '@react-native-community/netinfo'

const useConnection = () => {
  const [isConnected, setIsConnected] = useState(true)
  const unsubscribeRef = useRef<(() => void) | null>(null)
  const appStateRef = useRef(AppState.currentState)

  const subscribe = useCallback(() => {
    if (unsubscribeRef.current) return // Already subscribed

    unsubscribeRef.current = NetInfo.addEventListener(
      ({ isConnected: userIsConnected }: NetInfoState) => {
        console.log('[Connection] Is connected:', userIsConnected)
        setIsConnected(userIsConnected ?? true)
      }
    )
  }, [])

  const unsubscribe = useCallback(() => {
    if (unsubscribeRef.current) {
      unsubscribeRef.current()
      unsubscribeRef.current = null
    }
  }, [])

  useEffect(() => {
    // Initial subscription
    subscribe()

    // Only manage subscription on Android (where the crash occurs)
    // This prevents CannotDeliverBroadcastException when app is in background
    if (Platform.OS === 'android') {
      const handleAppStateChange = (nextAppState: AppStateStatus) => {
        if (appStateRef.current === 'active' && nextAppState.match(/inactive|background/)) {
          // App is going to background - unsubscribe to prevent broadcast issues
          unsubscribe()
        } else if (appStateRef.current.match(/inactive|background/) && nextAppState === 'active') {
          // App is coming to foreground - resubscribe and refresh state
          subscribe()
          NetInfo.fetch().then(state => {
            setIsConnected(state.isConnected ?? true)
          })
        }
        appStateRef.current = nextAppState
      }

      const subscription = AppState.addEventListener('change', handleAppStateChange)

      return () => {
        subscription.remove()
        unsubscribe()
      }
    }

    return () => {
      unsubscribe()
    }
  }, [subscribe, unsubscribe])

  return isConnected
}

export default useConnection
