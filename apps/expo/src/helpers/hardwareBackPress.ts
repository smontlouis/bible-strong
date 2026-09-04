import { BackHandler } from 'react-native'

export type HardwareBackPressHandler = () => boolean

export const subscribeToHardwareBackPress = (handler: HardwareBackPressHandler): (() => void) => {
  const subscription = BackHandler.addEventListener('hardwareBackPress', handler)
  return () => subscription.remove()
}
