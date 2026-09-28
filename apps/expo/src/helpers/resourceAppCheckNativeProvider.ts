import { getApp } from '@react-native-firebase/app'
import {
  getToken,
  initializeAppCheck,
  ReactNativeFirebaseAppCheckProvider,
} from '@react-native-firebase/app-check'
import { Platform } from 'react-native'

import androidAppCheck from '../../modules/bible-strong-app-check/src/BibleStrongAppCheckModule'

export interface ResourceAppCheckClient {
  getToken(forceRefresh: boolean): Promise<{ token: string; expiresAtMillis?: number }>
}

export const getResourceAppCheckProviderName = () => {
  if (__DEV__) return 'debug'
  if (Platform.OS === 'android') return androidAppCheck?.provider ?? 'playIntegrity'
  return 'appAttestWithDeviceCheckFallback'
}

export const initializeResourceAppCheckClient = async (): Promise<ResourceAppCheckClient> => {
  const native = androidAppCheck
  if (Platform.OS === 'android' && !__DEV__ && native?.provider === 'recaptchaEnterprise') {
    // The build selects this provider. Never install RNFirebase's Play Integrity factory afterward.
    await native.initialize(getApp().name)
    return {
      getToken: async forceRefresh => {
        // Keep compatibility with installed v1 binaries; the native runtime is bumped for v2.
        if (!native.getTokenWithDiagnostics) return native.getToken(forceRefresh)
        const result = await native.getTokenWithDiagnostics(forceRefresh)
        if (result.error) {
          let cause: Error | undefined
          for (const item of result.error.causes.slice(0, 4).reverse()) {
            cause = Object.assign(new Error(item.message), { name: item.name, cause })
          }
          throw Object.assign(cause ?? new Error('App Check failed'), { code: result.error.code })
        }
        return result
      },
    }
  }

  const provider = new ReactNativeFirebaseAppCheckProvider()
  provider.configure({
    android: { provider: __DEV__ ? 'debug' : 'playIntegrity' },
    apple: { provider: __DEV__ ? 'debug' : 'appAttestWithDeviceCheckFallback' },
  })
  const appCheck = await initializeAppCheck(getApp(), { provider, isTokenAutoRefreshEnabled: true })
  return { getToken: forceRefresh => getToken(appCheck, forceRefresh) }
}
