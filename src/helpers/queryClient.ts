import NetInfo from '@react-native-community/netinfo'
import { focusManager, onlineManager, QueryClient } from '@tanstack/react-query'
import { AppState, Platform } from 'react-native'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      networkMode: 'always',
      retry: 1,
    },
  },
})

let managersConfigured = false

export const configureQueryManagers = () => {
  if (managersConfigured) return
  managersConfigured = true

  onlineManager.setEventListener(setOnline =>
    NetInfo.addEventListener(state => {
      setOnline(state.isConnected === true)
    })
  )

  if (Platform.OS !== 'web') {
    focusManager.setEventListener(setFocused => {
      const subscription = AppState.addEventListener('change', status => {
        setFocused(status === 'active')
      })

      return () => subscription.remove()
    })
  }
}
