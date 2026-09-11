import { appLogger } from './agentObservability'
import {
  createAnalyticsClient,
  analyticsRoute,
  type AnalyticsTransport,
  type AnalyticsEvent,
  type AnalyticsParameters,
} from './analyticsCore'

let transportPromise: Promise<AnalyticsTransport | null> | undefined
const load = () => {
  transportPromise ??= (async () => {
    if (typeof window === 'undefined') return null
    const sdk = await import('firebase/analytics')
    if (!(await sdk.isSupported())) return null
    const { firebaseApp } = await import('./firebaseApp.web')
    if (!firebaseApp.options.measurementId) {
      appLogger.warn('startup', 'analytics.missing_measurement_id')
      return null
    }
    const analytics = sdk.initializeAnalytics(firebaseApp, {
      config: { send_page_view: false },
    })
    return {
      event: (name, parameters) =>
        sdk.logEvent(analytics, name, {
          ...parameters,
          ...(process.env.EXPO_PUBLIC_ANALYTICS_DEBUG === 'true' ? { debug_mode: true } : {}),
        }),
      identify: userId => sdk.setUserId(analytics, userId),
    }
  })()
  return transportPromise
}
const client = createAnalyticsClient(
  load,
  () =>
    (typeof __DEV__ !== 'undefined' && !__DEV__) ||
    process.env.EXPO_PUBLIC_ANALYTICS_DEBUG === 'true',
  () => appLogger.warn('startup', 'analytics.delivery_failed')
)

export const identifyAnalyticsUser = client.identify
export const trackAnalyticsEvent = (name: AnalyticsEvent, parameters?: AnalyticsParameters) =>
  client.event(name, parameters)
export const trackAnalyticsScreen = (segments: readonly string[]) => {
  const route = analyticsRoute(segments)
  return client.event('page_view', {
    page_title: route.name,
    page_location: `${typeof window === 'undefined' ? '' : window.location.origin}${route.path}`,
    page_path: route.path,
  })
}
