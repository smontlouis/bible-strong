import type { DatabaseError } from './catchDatabaseError'

export const isDatabaseError = (value: unknown): value is DatabaseError =>
  !!value && typeof value === 'object' && 'error' in value

export class DatabaseQueryError extends Error {
  code: DatabaseError['error']

  constructor(code: DatabaseError['error']) {
    super(code)
    this.name = 'DatabaseQueryError'
    this.code = code
  }
}

export const unwrapDatabaseResult = <T>(value: T | DatabaseError): T => {
  if (isDatabaseError(value)) {
    throw new DatabaseQueryError(value.error)
  }

  return value
}

export const getDatabaseQueryErrorCode = (error: unknown): DatabaseError['error'] | null =>
  error instanceof DatabaseQueryError ? error.code : error ? 'UNKNOWN_ERROR' : null
