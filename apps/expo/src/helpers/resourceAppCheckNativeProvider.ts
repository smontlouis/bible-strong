import { getApp } from '@react-native-firebase/app'
import {
  getToken,
  initializeAppCheck,
  ReactNativeFirebaseAppCheckProvider,
} from '@react-native-firebase/app-check'
import { Platform } from 'react-native'

import androidAppCheck from '../../modules/bible-strong-app-check/src/BibleStrongAppCheckModule'

export interface ResourceAppCheckClient {
  getToken(forceRefresh: boolean): Promise<{ token: string }>
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
    return { getToken: forceRefresh => native.getToken(forceRefresh) }
  }

  const provider = new ReactNativeFirebaseAppCheckProvider()
  provider.configure({
    android: { provider: __DEV__ ? 'debug' : 'playIntegrity' },
    apple: { provider: __DEV__ ? 'debug' : 'appAttestWithDeviceCheckFallback' },
  })
  const appCheck = await initializeAppCheck(getApp(), { provider, isTokenAutoRefreshEnabled: true })
  return { getToken: forceRefresh => getToken(appCheck, forceRefresh) }
}
