import type { ErrorEvent } from '@sentry/react-native'

import { createSentryEventFilter, EXPECTED_CONDITION_SAMPLE_RATE } from '../sentryEventFilter'

const errorEvent = ({
  area = 'download',
  event = 'resource.install_failed',
  errorCode,
  type = 'Error',
  value,
  handled = true,
}: {
  area?: string
  event?: string
  errorCode?: string
  type?: string
  value: string
  handled?: boolean
}): ErrorEvent => ({
  type: undefined,
  level: 'error',
  tags: {
    'diagnostic.area': area,
    'diagnostic.event': event,
    ...(errorCode ? { 'diagnostic.error_code': errorCode } : {}),
  },
  exception: { values: [{ type, value, mechanism: { type: 'generic', handled } }] },
})

const keptSample = () => 0
const droppedSample = () => 0.99

describe('Sentry event filter', () => {
  it('always sends crashes, even repeated or offline', () => {
    const filter = createSentryEventFilter({ random: droppedSample })
    const crash = () => errorEvent({ value: 'NETWORK_OFFLINE', handled: false })

    expect(filter(crash(), {})).not.toBeNull()
    expect(filter(crash(), {})).not.toBeNull()
  })

  it('sends a handled failure once per launch', () => {
    const filter = createSentryEventFilter()

    expect(filter(errorEvent({ value: 'ARCHIVE_EXTRACTION_FAILED' }), {})).not.toBeNull()
    expect(filter(errorEvent({ value: 'ARCHIVE_EXTRACTION_FAILED' }), {})).toBeNull()
    expect(filter(errorEvent({ value: 'ERR_INTERNAL_SQLITE_ERROR' }), {})).not.toBeNull()
    expect(
      filter(errorEvent({ event: 'queue.restore_failed', value: 'ARCHIVE_EXTRACTION_FAILED' }), {})
    ).not.toBeNull()
  })

  it('names a failure by its code, not by the request details in its message', () => {
    const filter = createSentryEventFilter()
    const permissionDenied = (requestId: string) =>
      errorEvent({
        area: 'sync',
        event: 'subcollection.batch_write_failed',
        errorCode: 'firestore/permission-denied',
        value: `[firestore/permission-denied] requestId=${requestId}`,
      })

    expect(filter(permissionDenied('a1'), {})).not.toBeNull()
    expect(filter(permissionDenied('b2'), {})).toBeNull()
  })

  it.each([
    errorEvent({ event: 'search.strong.failed', value: 'RESOURCE_REQUEST_ABORTED' }),
    errorEvent({ event: 'search.nave.failed', type: 'AbortError', value: 'Aborted' }),
  ])('drops cancelled requests', event => {
    expect(createSentryEventFilter({ random: keptSample })(event, {})).toBeNull()
  })

  it.each([
    errorEvent({ errorCode: 'NETWORK_OFFLINE', value: 'NETWORK_OFFLINE' }),
    errorEvent({ value: 'TEMPORARY_UNAVAILABLE (HTTP 503, requestId=abc)' }),
    errorEvent({ value: 'RESOURCE_DOWNLOAD_TIMEOUT' }),
    errorEvent({
      event: 'resource_app_check.token_failed',
      errorCode: 'RESOURCE_APPCHECK_TOKEN_ERROR',
      value: '[appCheck/token-error] The Play Store needs to be updated.',
    }),
    errorEvent({ value: '[appCheck/token-error] Unable to resolve host' }),
  ])('keeps a small sample of expected conditions', event => {
    expect(createSentryEventFilter({ random: droppedSample })({ ...event }, {})).toBeNull()

    const kept = createSentryEventFilter({ random: keptSample })({ ...event }, {})
    expect(kept?.tags?.['diagnostic.sample_rate']).toBe(EXPECTED_CONDITION_SAMPLE_RATE)
  })

  it('keeps every startup failure that is not a condition of the device', () => {
    const filter = createSentryEventFilter({ random: droppedSample })

    expect(
      filter(
        errorEvent({
          area: 'startup',
          event: 'app_migration.failed',
          errorCode: 'LEGACY_REPLACEMENT_NOT_COMPATIBLE',
          value: 'LEGACY_REPLACEMENT_NOT_COMPATIBLE',
        }),
        {}
      )
    ).not.toBeNull()
  })

  it.each([
    errorEvent({
      area: 'startup',
      event: 'app_migration.failed',
      errorCode: 'RESOURCE_OFFLINE',
      value: 'RESOURCE_OFFLINE (Unable to resolve host "api.bible-strong.app")',
    }),
    errorEvent({
      area: 'startup',
      event: 'app_migration.failed',
      errorCode: 'RESOURCE_STORAGE_FULL',
      value: 'RESOURCE_STORAGE_FULL (write failed: ENOSPC (No space left on device))',
    }),
    errorEvent({
      area: 'sync',
      event: 'account_sync.initial_load_timeout',
      value: 'ACCOUNT_SYNC_INITIAL_LOAD_TIMEOUT',
    }),
  ])('samples conditions of the device, at startup too', event => {
    expect(createSentryEventFilter({ random: droppedSample })({ ...event }, {})).toBeNull()
    expect(createSentryEventFilter({ random: keptSample })({ ...event }, {})).not.toBeNull()
  })

  it.each([
    errorEvent({ event: 'resource_api.protected_request_failed', value: 'RESOURCE_API_HTTP_503' }),
    errorEvent({ value: 'Offline copy is invalid' }),
    errorEvent({ value: "Call to function 'NativeDatabase.execAsync' has been rejected." }),
  ])('keeps bugs and responses of our own API', event => {
    expect(createSentryEventFilter({ random: droppedSample })(event, {})).not.toBeNull()
  })

  it('gives each rejected native call its own issue, whatever the numbers in its cause', () => {
    const filter = createSentryEventFilter()
    const rejection = (value: string, handled = true) =>
      errorEvent({ area: 'unknown', event: '', value, handled })

    expect(
      filter(
        rejection(
          "Call to function 'NativeStatement.finalizeAsync' has been rejected.\n→ Caused by: Error code 11: database disk image is malformed",
          false
        ),
        {}
      )?.fingerprint
    ).toEqual([
      'expo-native-call',
      '',
      'NativeStatement.finalizeAsync',
      'Error code <n>: database disk image is malformed',
    ])
    expect(
      filter(
        rejection(
          "Call to function 'ExpoSpeech.getVoices' has been rejected.\n→ Caused by: Unable to get voices."
        ),
        {}
      )?.fingerprint
    ).toEqual(['expo-native-call', '', 'ExpoSpeech.getVoices', 'Unable to get voices.'])
    expect(filter(errorEvent({ value: 'ARCHIVE_EXTRACTION_FAILED' }), {})?.fingerprint).toBe(
      undefined
    )
  })
})
