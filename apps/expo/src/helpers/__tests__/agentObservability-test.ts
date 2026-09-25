/* eslint-disable import/first */

const mockAddBreadcrumb = jest.fn()
const mockCaptureException = jest.fn()
const mockSetContext = jest.fn()
const mockSetLevel = jest.fn()
const mockSetTag = jest.fn()
const mockWithScope = jest.fn((callback: (scope: unknown) => void) =>
  callback({
    setContext: mockSetContext,
    setLevel: mockSetLevel,
    setTag: mockSetTag,
  })
)

jest.mock('@sentry/react-native', () => ({
  addBreadcrumb: (breadcrumb: unknown) => mockAddBreadcrumb(breadcrumb),
  captureException: (error: unknown) => mockCaptureException(error),
  withScope: (callback: (scope: unknown) => void) => mockWithScope(callback),
}))

import { appLogger, sanitizeDiagnosticPayload } from '../agentObservability'

describe('agent observability', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('indexes the selected App Check provider without exposing credentials', () => {
    appLogger.captureError('download', 'resource_app_check.token_failed', new Error('refused'), {
      appCheckProvider: 'recaptchaEnterprise',
      token: 'private-attestation-token',
    })
    expect(mockSetTag).toHaveBeenCalledWith('diagnostic.app_check_provider', 'recaptchaEnterprise')
    expect(mockSetContext).toHaveBeenCalledWith(
      'diagnostic',
      expect.objectContaining({ appCheckProvider: 'recaptchaEnterprise', token: '[REDACTED]' })
    )
  })

  it('propagates cancelled requests without reporting an exception', async () => {
    const controller = new AbortController()
    const error = new Error('RESOURCE_REQUEST_ABORTED')
    const request = appLogger.measure(
      'database',
      'search.sqlite',
      () =>
        new Promise<never>((_resolve, reject) => {
          controller.signal.addEventListener('abort', () => reject(error), { once: true })
        }),
      { queryLength: 4 },
      controller.signal
    )
    controller.abort()
    await expect(request).rejects.toBe(error)
    expect(mockCaptureException).not.toHaveBeenCalled()
  })

  it.each(['RESOURCE_REQUEST_TIMEOUT', 'HTTP 500'])(
    'still reports %s for an active request',
    async message => {
      const error = new Error(message)
      await expect(
        appLogger.measure(
          'database',
          'search.sqlite',
          async () => {
            throw error
          },
          undefined,
          new AbortController().signal
        )
      ).rejects.toBe(error)
      expect(mockCaptureException).toHaveBeenCalledTimes(1)
    }
  )

  it('keeps useful technical context while redacting private values', () => {
    const circular: Record<string, unknown> = {}
    circular.self = circular

    expect(
      sanitizeDiagnosticPayload({
        migrationId: 'local-resource-layout-v2',
        stepId: 'download-resources',
        resourceId: 'bible-lsg',
        retryCount: 2,
        status: 401,
        downloadUrl: 'https://api.bible-strong.app/v1/file?signature=secret#fragment',
        email: 'reader@example.com',
        authorization: 'Bearer abc.def.ghi',
        errorMessage: 'Failed for reader@example.com with Bearer abc.def.ghi',
        reduxState: { private: true },
        circular,
      })
    ).toEqual({
      migrationId: 'local-resource-layout-v2',
      stepId: 'download-resources',
      resourceId: 'bible-lsg',
      retryCount: 2,
      status: 401,
      downloadUrl: 'https://api.bible-strong.app/v1/file',
      email: '[REDACTED]',
      authorization: '[REDACTED]',
      errorMessage: 'Failed for [REDACTED_EMAIL] with Bearer [REDACTED]',
      reduxState: '[REDACTED]',
      circular: { self: '[circular]' },
    })
  })

  it('captures handled failures with stable tags, sanitized context, and a breadcrumb', () => {
    appLogger.captureError(
      'startup',
      'app_migration.failed',
      { message: 'Migration failed for reader@example.com' },
      {
        migrationId: 'local-resource-layout-v2',
        errorCode: 'APP_MIGRATION_UNEXPECTED_ERROR',
        userId: 'private-user-id',
      }
    )

    expect(mockAddBreadcrumb).toHaveBeenCalledWith(
      expect.objectContaining({
        category: 'bible-strong.startup',
        message: 'app_migration.failed',
        level: 'error',
      })
    )
    expect(mockSetLevel).toHaveBeenCalledWith('error')
    expect(mockSetTag).toHaveBeenCalledWith('diagnostic.area', 'startup')
    expect(mockSetTag).toHaveBeenCalledWith('diagnostic.event', 'app_migration.failed')
    expect(mockSetTag).toHaveBeenCalledWith(
      'diagnostic.error_code',
      'APP_MIGRATION_UNEXPECTED_ERROR'
    )
    expect(mockSetContext).toHaveBeenCalledWith('diagnostic', {
      migrationId: 'local-resource-layout-v2',
      errorCode: 'APP_MIGRATION_UNEXPECTED_ERROR',
      userId: '[REDACTED]',
      error: {
        name: 'Error',
        message: 'Migration failed for [REDACTED_EMAIL]',
      },
    })
    expect(mockCaptureException).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Migration failed for [REDACTED_EMAIL]',
      })
    )
  })
})
