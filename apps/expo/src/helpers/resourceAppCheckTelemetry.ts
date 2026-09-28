import * as Sentry from '@sentry/react-native'
import { AppState, Platform } from 'react-native'
import { nativeApplicationVersion, nativeBuildVersion } from 'expo-application'

// Fixed dimensions only: never include a token, URL, account ID or arbitrary error text.
type Observation = {
  provider: string
  outcome: 'success' | 'failure' | 'coalesced' | 'cooldown' | 'recovered'
  phase: 'initialize' | 'acquire' | 'caller'
  forceRefresh: boolean
  durationMs: number
}
type Bucket = Omit<Observation, 'durationMs'> & { count: number; durationTotalMs: number }
const buckets = new Map<string, Bucket>()
let timer: ReturnType<typeof setTimeout> | undefined
let listening = false

export const filterAppCheckLog: NonNullable<Sentry.ReactNativeOptions['beforeSendLog']> = log => {
  if (log.message !== 'resource_app_check.summary') return null
  const allowed = new Set([
    'provider',
    'outcome',
    'phase',
    'forceRefresh',
    'count',
    'durationTotalMs',
    'platform',
    'osVersion',
    'appVersion',
    'buildNumber',
    'sentry.release',
    'sentry.environment',
    'sentry.sdk.name',
    'sentry.sdk.version',
  ])
  return {
    ...log,
    attributes: Object.fromEntries(
      Object.entries(log.attributes ?? {}).filter(
        ([key, value]) => allowed.has(key) && ['string', 'number', 'boolean'].includes(typeof value)
      )
    ),
  }
}

export const flushAppCheckTelemetry = () => {
  if (timer) clearTimeout(timer)
  timer = undefined
  const pending = [...buckets.values()]
  buckets.clear()
  for (const bucket of pending) {
    try {
      Sentry.logger.info('resource_app_check.summary', {
        ...bucket,
        platform: Platform.OS,
        osVersion: String(Platform.Version),
        appVersion: nativeApplicationVersion ?? 'unknown',
        buildNumber: nativeBuildVersion ?? 'unknown',
      })
    } catch {
      /* Telemetry must never affect resource access. */
    }
  }
}

export const recordAppCheckObservation = (observation: Observation) => {
  if (__DEV__) return
  try {
    if (!listening) {
      AppState.addEventListener('change', state => {
        if (state !== 'active') flushAppCheckTelemetry()
      })
      listening = true
    }
    const provider = [
      'playIntegrity',
      'recaptchaEnterprise',
      'appAttestWithDeviceCheckFallback',
      'debug',
    ].includes(observation.provider)
      ? observation.provider
      : 'unknown'
    const { outcome, phase, forceRefresh } = observation
    const key = `${provider}:${outcome}:${phase}:${forceRefresh}`
    const bucket = buckets.get(key) ?? {
      provider,
      outcome,
      phase,
      forceRefresh,
      count: 0,
      durationTotalMs: 0,
    }
    bucket.count++
    bucket.durationTotalMs += Math.max(0, observation.durationMs)
    buckets.set(key, bucket)
    // One report per dimension per minute, also flushed when the app backgrounds.
    if (!timer) timer = setTimeout(flushAppCheckTelemetry, 60_000)
  } catch {
    /* Diagnostics are best effort, including during startup. */
  }
}
