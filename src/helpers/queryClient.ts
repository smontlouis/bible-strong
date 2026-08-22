import NetInfo from '@react-native-community/netinfo'
import { focusManager, onlineManager, QueryClient } from '@tanstack/react-query'
import { AppState, Platform } from 'react-native'
import { connectionStatusFromNetInfo } from './useConnection'
import { isOfflineModeForced } from './runtimeConfig'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      networkMode: 'offlineFirst',
      retry: 1,
    },
    mutations: {
      networkMode: 'online',
    },
  },
})

let managersConfigured = false

export const configureQueryManagers = () => {
  if (managersConfigured) return
  managersConfigured = true

  if (isOfflineModeForced) {
    onlineManager.setOnline(false)
  } else {
    onlineManager.setEventListener(setOnline =>
      NetInfo.addEventListener(state => {
        setOnline(connectionStatusFromNetInfo(state) === 'internet')
      })
    )
  }

  if (Platform.OS !== 'web') {
    focusManager.setEventListener(setFocused => {
      const subscription = AppState.addEventListener('change', status => {
        setFocused(status === 'active')
      })

      return () => subscription.remove()
    })
  }
}
