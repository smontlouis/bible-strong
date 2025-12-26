// Web shim for @react-native-firebase/remote-config
// Uses Firebase JS SDK instead of native module

import { firebaseApp } from './firebase-web-init'
import {
  getRemoteConfig as getRemoteConfigWeb,
  getValue as getValueWeb,
  fetchAndActivate as fetchAndActivateWeb,
  getAll as getAllWeb,
} from 'firebase/remote-config'

let remoteConfigInstance: ReturnType<typeof getRemoteConfigWeb> | null = null

const getRemoteConfigInstance = () => {
  if (!remoteConfigInstance) {
    try {
      remoteConfigInstance = getRemoteConfigWeb(firebaseApp)
      // Set default settings
      remoteConfigInstance.settings.minimumFetchIntervalMillis = 3600000 // 1 hour
    } catch (e) {
      console.warn('[RemoteConfig] Failed to initialize remote config:', e)
    }
  }
  return remoteConfigInstance
}

// Re-export everything from Firebase JS SDK
export const getRemoteConfig = getRemoteConfigInstance

export const setDefaults = async (_config: any, defaults: Record<string, any>) => {
  const instance = getRemoteConfigInstance()
  if (instance) {
    instance.defaultConfig = defaults
  }
}

export const getValue = (_config: any, key: string) => {
  const instance = getRemoteConfigInstance()
  if (instance) {
    return getValueWeb(instance, key)
  }
  // Return a default value object
  return {
    asString: () => '',
    asNumber: () => 0,
    asBoolean: () => false,
    getSource: () => 'default',
  }
}

export const fetchAndActivate = async (_config: any) => {
  const instance = getRemoteConfigInstance()
  if (instance) {
    try {
      return await fetchAndActivateWeb(instance)
    } catch (e) {
      console.warn('[RemoteConfig] Failed to fetch and activate:', e)
      return false
    }
  }
  return false
}

export const getAll = (_config: any) => {
  const instance = getRemoteConfigInstance()
  if (instance) {
    return getAllWeb(instance)
  }
  return {}
}

export default {
  getRemoteConfig,
  setDefaults,
  getValue,
  fetchAndActivate,
  getAll,
}
