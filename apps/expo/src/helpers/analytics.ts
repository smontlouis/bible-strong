import { appLogger } from './agentObservability'
import {
  createAnalyticsClient,
  analyticsRoute,
  type AnalyticsEvent,
  type AnalyticsParameters,
} from './analyticsCore'

const client = createAnalyticsClient(
  async () => {
    const sdk = await import('@react-native-firebase/analytics')
    const analytics = sdk.getAnalytics()
    return {
      event: (name, parameters) =>
        name === 'screen_view'
          ? sdk.logScreenView(analytics, parameters)
          : sdk.logEvent(analytics, name, parameters),
      identify: userId => sdk.setUserId(analytics, userId),
    }
  },
  () => typeof __DEV__ !== 'undefined' && !__DEV__,
  () => appLogger.warn('startup', 'analytics.delivery_failed')
)

export const identifyAnalyticsUser = client.identify
export const trackAnalyticsEvent = (name: AnalyticsEvent, parameters?: AnalyticsParameters) =>
  client.event(name, parameters)
export const trackAnalyticsScreen = (segments: readonly string[]) => {
  const { name } = analyticsRoute(segments)
  return client.event('screen_view', { screen_name: name, screen_class: name })
}
