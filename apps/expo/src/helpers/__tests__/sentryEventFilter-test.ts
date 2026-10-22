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

  it('keeps every startup failure, whatever its cause', () => {
    const filter = createSentryEventFilter({ random: droppedSample })

    expect(
      filter(
        errorEvent({
          area: 'startup',
          event: 'app_migration.failed',
          errorCode: 'RESOURCE_APPCHECK_TOKEN_ERROR',
          value: 'RESOURCE_APPCHECK_TOKEN_ERROR',
        }),
        {}
      )
    ).not.toBeNull()
  })

  it.each([
    errorEvent({ event: 'resource_api.protected_request_failed', value: 'RESOURCE_API_HTTP_503' }),
    errorEvent({ value: 'Offline copy is invalid' }),
    errorEvent({ value: "Call to function 'NativeDatabase.execAsync' has been rejected." }),
  ])('keeps bugs and responses of our own API', event => {
    expect(createSentryEventFilter({ random: droppedSample })(event, {})).not.toBeNull()
  })
})
