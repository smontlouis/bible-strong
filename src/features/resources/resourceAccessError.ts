import type { DatabaseError } from '~helpers/catchDatabaseError'
import { isDatabaseError } from '~helpers/queryResult'

export type ResourceAccessErrorCode = 'INVALID_OFFLINE_COPY' | 'TEMPORARY_UNAVAILABLE' | 'UNKNOWN'

export type ResourceRecoveryAction = 'acquire-offline-copy' | 'manage-offline-copies'

export class ResourceAccessError extends Error {
  constructor(
    public readonly code: ResourceAccessErrorCode,
    public readonly recoveries: ResourceRecoveryAction[] = []
  ) {
    super(code)
    this.name = 'ResourceAccessError'
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
