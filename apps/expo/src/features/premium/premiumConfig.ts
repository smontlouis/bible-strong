import { Platform } from 'react-native'

/**
 * The public RevenueCat SDK key of this build. Development and staging builds carry the key of
 * RevenueCat's Test Store on the stores (their bundle identifiers, `.dev` and `.staging`, see no
 * store product) and the key of the Stripe sandbox on the Web. Each variable is read by name so
 * that Expo inlines it in the bundle.
 */
export const revenueCatApiKey = (): string | undefined => {
  const key = Platform.select({
    ios: process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY,
    android: process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY,
    web: process.env.EXPO_PUBLIC_REVENUECAT_WEB_API_KEY,
    default: undefined,
  })
  return key || undefined
}

/**
 * RevenueCat's Web Purchase Link of the `default` offering, ending with `/`: the installer
 * builds of the desktop app open it in the reader's browser, with the account's uid appended
 * (ADR-0110). Development and staging builds carry its sandbox address.
 */
export const revenueCatPurchaseLink = (): string | undefined =>
  process.env.EXPO_PUBLIC_REVENUECAT_PURCHASE_LINK || undefined

/** The terms of use the offer and the checkout link to, in the app's language. */
export const premiumTermsUrl = (language: string) =>
  language === 'fr' ? 'https://bible-strong.app/eula' : 'https://bible-strong.app/eula-en'

export const premiumPrivacyUrl = (language: string) =>
  language === 'fr'
    ? 'https://bible-strong.app/politique-de-confidentialite'
    : 'https://bible-strong.app/privacy-policy'
