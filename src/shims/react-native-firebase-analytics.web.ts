// Web shim for @react-native-firebase/analytics
// Uses Firebase JS SDK instead of native module

import { firebaseApp } from './firebase-web-init'
import {
  getAnalytics as getAnalyticsWeb,
  setUserId as setUserIdWeb,
  logEvent as logEventWeb,
} from 'firebase/analytics'

let analyticsInstance: ReturnType<typeof getAnalyticsWeb> | null = null

const getAnalyticsInstance = () => {
  if (!analyticsInstance) {
    try {
      analyticsInstance = getAnalyticsWeb(firebaseApp)
    } catch (e) {
      console.warn('[Analytics] Failed to initialize analytics:', e)
    }
  }
  return analyticsInstance
}

// Re-export everything from Firebase JS SDK
export const getAnalytics = getAnalyticsInstance

export const setUserId = (analytics: any, userId: string | null) => {
  const instance = getAnalyticsInstance()
  if (instance) {
    setUserIdWeb(instance, userId)
  }
}

export const logScreenView = (analytics: any, params: { screen_name: string; screen_class: string }) => {
  const instance = getAnalyticsInstance()
  if (instance) {
    logEventWeb(instance, 'screen_view', params)
  }
}

export const logEvent = (analytics: any, eventName: string, params?: Record<string, any>) => {
  const instance = getAnalyticsInstance()
  if (instance) {
    logEventWeb(instance, eventName, params)
  }
}

// Default export for compatibility with: import analytics from '@react-native-firebase/analytics'
const analyticsModule = () => ({
  logEvent: (eventName: string, params?: Record<string, any>) => {
    const instance = getAnalyticsInstance()
    if (instance) {
      logEventWeb(instance, eventName, params)
    }
  },
  setUserId: (userId: string | null) => {
    const instance = getAnalyticsInstance()
    if (instance) {
      setUserIdWeb(instance, userId)
    }
  },
  logScreenView: (params: { screen_name: string; screen_class: string }) => {
    const instance = getAnalyticsInstance()
    if (instance) {
      logEventWeb(instance, 'screen_view', params)
    }
  },
})

export default analyticsModule
