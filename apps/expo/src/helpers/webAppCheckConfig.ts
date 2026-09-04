export type FirebaseAppCheckDebugGlobal = {
  FIREBASE_APPCHECK_DEBUG_TOKEN?: boolean | string
}

const DEBUG_PROVIDER_SITE_KEY = 'firebase-app-check-debug'

export const getWebAppCheckSiteKey = (
  siteKey: string | undefined,
  isDevelopment: boolean
): string => {
  const normalizedSiteKey = siteKey?.trim()
  if (normalizedSiteKey) return normalizedSiteKey
  if (isDevelopment) return DEBUG_PROVIDER_SITE_KEY

  throw new Error(
    'Missing Expo Web Firebase App Check configuration: EXPO_PUBLIC_FIREBASE_APP_CHECK_SITE_KEY'
  )
}

export const enableWebAppCheckDebugMode = (
  target: FirebaseAppCheckDebugGlobal,
  isDevelopment: boolean
) => {
  if (isDevelopment && target.FIREBASE_APPCHECK_DEBUG_TOKEN === undefined) {
    target.FIREBASE_APPCHECK_DEBUG_TOKEN = true
  }
}
