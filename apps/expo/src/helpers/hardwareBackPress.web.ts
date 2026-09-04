import type { HardwareBackPressHandler } from './hardwareBackPress'

export const subscribeToHardwareBackPress =
  (_handler: HardwareBackPressHandler): (() => void) =>
  () =>
    undefined
