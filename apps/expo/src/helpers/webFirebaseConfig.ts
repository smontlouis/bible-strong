import type { FirebaseOptions } from 'firebase/app'

const REQUIRED_FIREBASE_WEB_CONFIG = {
  EXPO_PUBLIC_FIREBASE_API_KEY: 'apiKey',
  EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN: 'authDomain',
  EXPO_PUBLIC_FIREBASE_PROJECT_ID: 'projectId',
  EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET: 'storageBucket',
  EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: 'messagingSenderId',
  EXPO_PUBLIC_FIREBASE_APP_ID: 'appId',
} as const

type FirebaseWebEnvironment = Partial<Record<keyof typeof REQUIRED_FIREBASE_WEB_CONFIG, string>> & {
  EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID?: string
}

export const getWebFirebaseConfig = (environment: FirebaseWebEnvironment): FirebaseOptions => {
  const config: FirebaseOptions = {}

  for (const [environmentKey, configKey] of Object.entries(REQUIRED_FIREBASE_WEB_CONFIG) as [
    keyof typeof REQUIRED_FIREBASE_WEB_CONFIG,
    (typeof REQUIRED_FIREBASE_WEB_CONFIG)[keyof typeof REQUIRED_FIREBASE_WEB_CONFIG],
  ][]) {
    const value = environment[environmentKey]?.trim()
    if (!value) {
      throw new Error(`Missing Expo Web Firebase configuration: ${environmentKey}`)
    }
    config[configKey] = value
  }

  const measurementId = environment.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID?.trim()
  if (measurementId) config.measurementId = measurementId

  return config
}
