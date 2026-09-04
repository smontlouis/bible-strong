import type { DatabaseError } from '~helpers/catchDatabaseError'
import { isDatabaseError } from '~helpers/queryResult'
import type { BibleChapterUnavailableReason } from './bibleChapterSource'

export type ResourceAccessErrorCode =
  | 'OFFLINE_COPY_REQUIRED'
  | 'INVALID_OFFLINE_COPY'
  | 'NETWORK_OFFLINE'
  | 'RESOURCE_UNSUPPORTED'
  | 'NOT_FOUND'
  | 'INTEGRITY_FAILURE'
  | 'TEMPORARY_UNAVAILABLE'
  | 'UNKNOWN'

export type ResourceRecoveryAction =
  | 'retry'
  | 'acquire-offline-copy'
  | 'repair-offline-copy'
  | 'manage-offline-copies'
  | 'reset-offline-store'

export type ResourceAccessErrorDiagnostics = {
  httpStatus?: number
  requestId?: string
  retryAfterSeconds?: number
  serverCode?: string
}

const getDefaultRecoveries = (code: ResourceAccessErrorCode): ResourceRecoveryAction[] => {
  switch (code) {
    case 'NETWORK_OFFLINE':
    case 'TEMPORARY_UNAVAILABLE':
    case 'UNKNOWN':
      return ['retry']
    case 'INTEGRITY_FAILURE':
      return ['retry', 'repair-offline-copy', 'manage-offline-copies']
    default:
      return []
  }
}

export class ResourceAccessError extends Error {
  constructor(
    public readonly code: ResourceAccessErrorCode,
    public readonly recoveries: ResourceRecoveryAction[] = getDefaultRecoveries(code),
    diagnostics: ResourceAccessErrorDiagnostics = {}
  ) {
    const diagnosticParts = [
      diagnostics.httpStatus === undefined ? undefined : `HTTP ${diagnostics.httpStatus}`,
      diagnostics.serverCode,
      diagnostics.requestId ? `requestId=${diagnostics.requestId}` : undefined,
      diagnostics.retryAfterSeconds === undefined
        ? undefined
        : `retryAfter=${diagnostics.retryAfterSeconds}s`,
    ].filter((part): part is string => Boolean(part))
    super(diagnosticParts.length ? `${code} (${diagnosticParts.join(', ')})` : code)
    this.name = 'ResourceAccessError'
    this.httpStatus = diagnostics.httpStatus
    this.requestId = diagnostics.requestId
    this.retryAfterSeconds = diagnostics.retryAfterSeconds
    this.serverCode = diagnostics.serverCode
  }

  readonly httpStatus?: number
  readonly requestId?: string
  readonly retryAfterSeconds?: number
  readonly serverCode?: string
}

export const resourceAccessErrorFromHttpResponse = (
  code: ResourceAccessErrorCode,
  response: Response,
  serverCode: unknown,
  recoveries?: ResourceRecoveryAction[]
): ResourceAccessError => {
  const retryAfterHeader = response.headers.get('retry-after')
  const retryAfter = retryAfterHeader === null ? undefined : Number(retryAfterHeader)
  return new ResourceAccessError(code, recoveries ?? getDefaultRecoveries(code), {
    httpStatus: response.status,
    ...(response.headers.get('x-request-id')
      ? { requestId: response.headers.get('x-request-id') ?? undefined }
      : {}),
    ...(retryAfter !== undefined && Number.isFinite(retryAfter) && retryAfter >= 0
      ? { retryAfterSeconds: retryAfter }
      : {}),
    ...(typeof serverCode === 'string' && serverCode ? { serverCode } : {}),
  })
}

export const resourceAccessErrorFromBibleChapterUnavailable = (
  reason: BibleChapterUnavailableReason,
  recoveries?: ResourceRecoveryAction[],
  diagnostics?: ResourceAccessErrorDiagnostics
): ResourceAccessError => {
  switch (reason) {
    case 'publication-not-available':
      return new ResourceAccessError(
        'OFFLINE_COPY_REQUIRED',
        recoveries ?? ['acquire-offline-copy'],
        diagnostics
      )
    case 'chapter-not-available':
    case 'verses-not-available':
      return new ResourceAccessError('NOT_FOUND', recoveries, diagnostics)
    case 'offline-copy-invalid':
      return new ResourceAccessError(
        'INVALID_OFFLINE_COPY',
        recoveries ?? ['acquire-offline-copy', 'manage-offline-copies'],
        diagnostics
      )
    case 'resource-unsupported':
      return new ResourceAccessError('RESOURCE_UNSUPPORTED', recoveries, diagnostics)
    case 'network-offline':
      return new ResourceAccessError('NETWORK_OFFLINE', recoveries, diagnostics)
    case 'temporary-unavailable':
      return new ResourceAccessError('TEMPORARY_UNAVAILABLE', recoveries, diagnostics)
    case 'integrity-failure':
      return new ResourceAccessError('INTEGRITY_FAILURE', recoveries, diagnostics)
  }
}

const mapDatabaseError = (error: DatabaseError['error']) => {
  if (error === 'CORRUPTED_DATABASE') {
    return new ResourceAccessError('INVALID_OFFLINE_COPY', [
      'acquire-offline-copy',
      'manage-offline-copies',
    ])
  }
  if (error === 'DISK_IO') return new ResourceAccessError('TEMPORARY_UNAVAILABLE')
  return new ResourceAccessError('UNKNOWN')
}

export const unwrapLocalResourceResult = <T>(value: T | DatabaseError): T => {
  if (isDatabaseError(value)) throw mapDatabaseError(value.error)
  return value
}

export const mapLocalResourceError = (error: unknown): ResourceAccessError => {
  if (error instanceof ResourceAccessError) return error
  const message = error instanceof Error ? error.message : String(error)
  if (message.includes('CORRUPTED_DATABASE') || message.includes('no such table')) {
    return mapDatabaseError('CORRUPTED_DATABASE')
  }
  if (message.includes('DISK_IO') || message.includes('disk I/O')) {
    return mapDatabaseError('DISK_IO')
  }
  return new ResourceAccessError('UNKNOWN')
}

export const getResourceAccessErrorCode = (error: unknown): ResourceAccessErrorCode | null =>
  error instanceof ResourceAccessError ? error.code : error ? 'UNKNOWN' : null
