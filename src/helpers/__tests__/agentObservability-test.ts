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
