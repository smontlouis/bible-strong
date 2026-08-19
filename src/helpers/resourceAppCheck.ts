import { getApp } from '@react-native-firebase/app'
import {
  getToken,
  initializeAppCheck,
  ReactNativeFirebaseAppCheckProvider,
  type FirebaseAppCheckTypes,
} from '@react-native-firebase/app-check'

import {
  createResourceAppCheckFetch,
  getResourceAppCheckHeaders as createResourceAppCheckHeaders,
} from './resourceAppCheckRequest'

let appCheckInitialization: Promise<FirebaseAppCheckTypes.Module> | undefined

const initializeResourceAppCheck = (): Promise<FirebaseAppCheckTypes.Module> => {
  if (appCheckInitialization) return appCheckInitialization

  const provider = new ReactNativeFirebaseAppCheckProvider()
  provider.configure({
    android: { provider: __DEV__ ? 'debug' : 'playIntegrity' },
    apple: { provider: __DEV__ ? 'debug' : 'appAttestWithDeviceCheckFallback' },
  })
  appCheckInitialization = initializeAppCheck(getApp(), {
    provider,
    isTokenAutoRefreshEnabled: true,
  })
  return appCheckInitialization
}

export const getResourceAppCheckToken = async (forceRefresh = false): Promise<string> => {
  const result = await getToken(await initializeResourceAppCheck(), forceRefresh)
  if (!result.token) throw new Error('RESOURCE_APP_CHECK_TOKEN_MISSING')
  return result.token
}

export const resourceApiFetch = createResourceAppCheckFetch(fetch, getResourceAppCheckToken)

export const getResourceDownloadHeaders = (url: string): Promise<Record<string, string>> =>
  createResourceAppCheckHeaders(url, getResourceAppCheckToken)
