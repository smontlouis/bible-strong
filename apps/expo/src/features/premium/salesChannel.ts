import { Platform } from 'react-native'

/**
 * Where this surface sells Premium (ADR-0110). The iOS app, the iPad app on a Mac included, sells
 * through the App Store, the Android app through Google Play. The Web and the desktop app will
 * sell through the web checkout run by Stripe; until then they sell nothing.
 */
export type SalesChannel = 'app_store' | 'play_store' | 'none'

export const salesChannel = (): SalesChannel => {
  if (Platform.OS === 'ios') return 'app_store'
  if (Platform.OS === 'android') return 'play_store'
  return 'none'
}
