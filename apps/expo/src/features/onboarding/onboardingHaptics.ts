import * as Haptics from 'expo-haptics'
import { Platform } from 'react-native'

/**
 * The feel of the onboarding under the finger: a light tap for every touch, a soft one when
 * Strobi answers, a success when the reader asks to try it. The browser has no haptics.
 */
const enabled = Platform.OS !== 'web'

export const tapHaptic = () => {
  if (enabled) void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
}

export const softHaptic = () => {
  if (enabled) void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft)
}

export const successHaptic = () => {
  if (enabled) void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
}
