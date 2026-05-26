import type { NavigationState } from '@react-navigation/native'
import { useNavigation } from 'expo-router'
import { useSyncExternalStore } from 'react'

export const useCanGoBackInStack = () => {
  const navigation = useNavigation<{
    addListener: (event: 'state', callback: () => void) => () => void
    getState: () => NavigationState | undefined
  }>()

  return useSyncExternalStore(
    callback => navigation.addListener('state', callback),
    () => (navigation.getState()?.index ?? 0) > 0,
    () => false
  )
}
