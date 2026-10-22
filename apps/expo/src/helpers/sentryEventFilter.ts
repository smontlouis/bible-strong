import type { ErrorEvent, ReactNativeOptions } from '@sentry/react-native'

type EventHint = Parameters<NonNullable<ReactNativeOptions['beforeSend']>>[1]
type SentryEventFilter = (event: ErrorEvent, hint: EventHint) => ErrorEvent | null

/**
 * Share of expected conditions still sent, once per launch and failure. Kept events carry the
 * `diagnostic.sample_rate` tag: multiply their count by its inverse to estimate the real volume.
 */
export const EXPECTED_CONDITION_SAMPLE_RATE = 0.05

const MAX_REPORTED_FAILURES = 500

// A cancelled request is not a failure: typing in the search cancels the previous query.
const cancelledRequestCodes = new Set(['RESOURCE_REQUEST_ABORTED', 'ABORTERROR'])

// Conditions of the device or its network, not bugs: a lost connection, a slow one, a full disk.
// Responses of our own API keep their own `RESOURCE_API_HTTP_*` report and are not listed here.
const expectedConditionCodes = new Set([
  'OFFLINE',
  'NETWORK_OFFLINE',
  'RESOURCE_OFFLINE',
  'TEMPORARY_UNAVAILABLE',
  'RESOURCE_TEMPORARY_UNAVAILABLE',
  'RESOURCE_REQUEST_TIMEOUT',
  'RESOURCE_DOWNLOAD_TIMEOUT',
  'RESOURCE_STORAGE_FULL',
  'ACCOUNT_SYNC_INITIAL_LOAD_TIMEOUT',
])

const isAppCheckCode = (code: string) =>
  code.startsWith('RESOURCE_APPCHECK_') ||
  code.startsWith('RESOURCE_APP_CHECK_') ||
  code.startsWith('APPCHECK/')

const normalizeCode = (value: unknown) =>
  typeof value === 'string' ? value.trim().toUpperCase() : undefined

// `[appCheck/token-error] …`, `NETWORK_OFFLINE (HTTP 503, …)` and `RESOURCE_REQUEST_ABORTED`
// all start with their code. A sentence such as `Offline copy is invalid` does not.
const leadingCode = (message: unknown) => {
  if (typeof message !== 'string') return undefined
  const match = message.match(/^\[([A-Za-z][\w/-]*)\]|^([A-Z][A-Z0-9_]+)\b/)
  return normalizeCode(match?.[1] ?? match?.[2])
}

const eventErrorCodes = (event: ErrorEvent, hint: EventHint) => {
  const original = hint?.originalException
  const originalRecord =
    original && typeof original === 'object' ? (original as Record<string, unknown>) : undefined
  return [
    normalizeCode(event.tags?.['diagnostic.error_code']),
    normalizeCode(originalRecord?.code),
    normalizeCode(originalRecord?.name),
    leadingCode(originalRecord?.message),
    ...(event.exception?.values ?? []).flatMap(exception => [
      normalizeCode(exception.type),
      leadingCode(exception.value),
    ]),
  ].filter((code): code is string => Boolean(code))
}

const isUnhandled = (event: ErrorEvent) =>
  event.level === 'fatal' ||
  (event.exception?.values ?? []).some(exception => exception.mechanism?.handled === false)

const failureKey = (event: ErrorEvent) => {
  const exceptions = event.exception?.values ?? []
  // Sentry lists the thrown error last, after the errors it wraps.
  const exception = exceptions[exceptions.length - 1]
  const errorCode = event.tags?.['diagnostic.error_code']
  return [
    event.tags?.['diagnostic.area'] ?? '',
    event.tags?.['diagnostic.event'] ?? '',
    // The message can carry request ids or delays; the code alone names the failure.
    errorCode ??
      `${exception?.type ?? ''}:${exception?.value ?? event.message ?? ''}`.slice(0, 200),
  ].join('|')
}

/**
 * Drops handled errors that are not bugs before they reach Sentry. Each handled failure is sent
 * at most once per launch; the `appLogger` breadcrumb of later ones stays on the next report.
 */
export const createSentryEventFilter = ({
  random = Math.random,
  expectedConditionSampleRate = EXPECTED_CONDITION_SAMPLE_RATE,
}: {
  random?: () => number
  expectedConditionSampleRate?: number
} = {}): SentryEventFilter => {
  const reportedFailures = new Set<string>()

  return (event, hint) => {
    if (isUnhandled(event)) return event

    const key = failureKey(event)
    if (reportedFailures.has(key)) return null
    if (reportedFailures.size >= MAX_REPORTED_FAILURES) reportedFailures.clear()
    reportedFailures.add(key)

    // Startup and migration failures are sampled too when they only describe the device: an
    // outage of our own service still shows through the kept 5%.
    const codes = eventErrorCodes(event, hint)
    if (codes.some(code => cancelledRequestCodes.has(code))) return null
    if (codes.some(code => expectedConditionCodes.has(code) || isAppCheckCode(code))) {
      if (random() >= expectedConditionSampleRate) return null
      event.tags = { ...event.tags, 'diagnostic.sample_rate': expectedConditionSampleRate }
    }
    return event
  }
}

export const filterSentryEvent = createSentryEventFilter()
