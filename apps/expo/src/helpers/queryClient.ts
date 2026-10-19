import NetInfo from '@react-native-community/netinfo'
import { focusManager, onlineManager, QueryClient } from '@tanstack/react-query'
import { AppState, Platform } from 'react-native'
import { connectionStatusFromNetInfo, isOfflineFailureFromNetInfo } from './useConnection'
import { isOfflineModeForced } from './runtimeConfig'
import { resourceQueryKeys } from './resourceQueryKeys'
import { refetchResourceOnReconnect } from './resourceQueryRecovery'

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

queryClient.setQueryDefaults(resourceQueryKeys.all(), {
  refetchOnReconnect: refetchResourceOnReconnect,
  // An inactive screen may miss the reconnect event while its failure stays cached.
  refetchOnMount: refetchResourceOnReconnect,
})

let managersConfigured = false

export const configureQueryManagers = () => {
  if (managersConfigured) return
  managersConfigured = true

  if (isOfflineModeForced) {
    onlineManager.setOnline(false)
  } else {
    onlineManager.setEventListener(setOnline => {
      let unreachable = false
      return NetInfo.addEventListener(state => {
        const online = connectionStatusFromNetInfo(state) !== 'offline'
        const nowUnreachable = isOfflineFailureFromNetInfo(state)
        const regainedInternet =
          online && onlineManager.isOnline() && unreachable && !nowUnreachable
        unreachable = nowUnreachable
        setOnline(online)
        // A connected network that regains Internet access never toggles the online state, so
        // failed resource queries are refetched here as they would be on a reconnection.
        if (regainedInternet) queryClient.getQueryCache().onOnline()
      })
    })
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
