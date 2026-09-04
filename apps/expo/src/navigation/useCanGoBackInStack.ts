import { useNavigation } from 'expo-router'
import { NavigationState } from 'expo-router/build/react-navigation'
import { useSyncExternalStore } from 'react'

export const useCanGoBackInStack = () => {
  const navigation = useNavigation<{
    addListener: (event: 'state' | 'focus' | 'blur', callback: () => void) => () => void
    getState: () => NavigationState | undefined
    isFocused: () => boolean
  }>()

  const getSnapshot = () => {
    const state = navigation.getState()

    return Boolean(navigation.isFocused() && (state?.index ?? 0) > 0)
  }

  return useSyncExternalStore(
    callback => {
      const unsubscribeState = navigation.addListener('state', callback)
      const unsubscribeFocus = navigation.addListener('focus', callback)
      const unsubscribeBlur = navigation.addListener('blur', callback)

      return () => {
        unsubscribeState()
        unsubscribeFocus()
        unsubscribeBlur()
      }
    },
    getSnapshot,
    () => false
  )
}
