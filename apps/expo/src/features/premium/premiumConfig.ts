import { Platform } from 'react-native'

/**
 * The public RevenueCat SDK key of this build. Development and staging builds carry the key of
 * RevenueCat's Test Store: their bundle identifiers (`.dev`, `.staging`) see no store product.
 * Each variable is read by name so that Expo inlines it in the bundle.
 */
export const revenueCatApiKey = (): string | undefined => {
  const key = Platform.select({
    ios: process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY,
    android: process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY,
    default: undefined,
  })
  return key || undefined
}
