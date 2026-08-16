/**
 * Bible Loading Error Types
 *
 * These error types allow for granular error handling in the Bible view,
 * distinguishing between different error scenarios:
 * - Bible version not found (file doesn't exist)
 * - Chapter not found in the Bible version
 * - Generic loading errors
 */

export type BibleErrorType =
  | 'BIBLE_NOT_FOUND'
  | 'CHAPTER_NOT_FOUND'
  | 'OFFLINE_COPY_INVALID'
  | 'RESOURCE_UNSUPPORTED'
  | 'RESOURCE_OFFLINE'
  | 'RESOURCE_TEMPORARY_UNAVAILABLE'
  | 'RESOURCE_INTEGRITY_ERROR'
  | 'UNKNOWN_ERROR'

export type BibleRecoveryAction =
  | 'acquire-offline-copy'
  | 'manage-offline-copies'
  | 'reset-offline-store'

export interface BibleError {
  type: BibleErrorType
  version: string
  book?: number
  chapter?: number
  message: string
  recoveries?: BibleRecoveryAction[]
}

export type BibleErrorMessageKey =
  | 'versionNotFound'
  | 'chapterNotFound'
  | 'databaseCorrupted'
  | 'onlineUnsupported'
  | 'offlineUnavailable'
  | 'temporaryUnavailable'
  | 'integrityFailure'
  | 'unknown'

export const getBibleErrorPresentation = (type: BibleErrorType) => {
  const messageKey: BibleErrorMessageKey = (() => {
    switch (type) {
      case 'BIBLE_NOT_FOUND':
        return 'versionNotFound'
      case 'CHAPTER_NOT_FOUND':
        return 'chapterNotFound'
      case 'OFFLINE_COPY_INVALID':
        return 'databaseCorrupted'
      case 'RESOURCE_UNSUPPORTED':
        return 'onlineUnsupported'
      case 'RESOURCE_OFFLINE':
        return 'offlineUnavailable'
      case 'RESOURCE_TEMPORARY_UNAVAILABLE':
        return 'temporaryUnavailable'
      case 'RESOURCE_INTEGRITY_ERROR':
        return 'integrityFailure'
      default:
        return 'unknown'
    }
  })()
  return {
    messageKey,
    retryable: type === 'RESOURCE_TEMPORARY_UNAVAILABLE' || type === 'RESOURCE_INTEGRITY_ERROR',
  }
}

export class BibleLoadingError extends Error {
  type: BibleErrorType
  version: string
  book?: number
  chapter?: number

  constructor(
    type: BibleErrorType,
    version: string,
    book?: number,
    chapter?: number,
    message?: string
  ) {
    super(message || getBibleErrorMessage(type, version, book, chapter))
    this.name = 'BibleLoadingError'
    this.type = type
    this.version = version
    this.book = book
    this.chapter = chapter
  }
}

function getBibleErrorMessage(
  type: BibleErrorType,
  version: string,
  book?: number,
  chapter?: number
): string {
  switch (type) {
    case 'BIBLE_NOT_FOUND':
      return `Bible version ${version} not found`
    case 'CHAPTER_NOT_FOUND':
      return `Chapter ${chapter} of book ${book} not found in ${version}`
    case 'OFFLINE_COPY_INVALID':
      return `The offline copy for ${version} appears to be invalid`
    case 'RESOURCE_UNSUPPORTED':
      return `Bible version ${version} is not available from the configured sources`
    case 'RESOURCE_OFFLINE':
      return `Bible version ${version} is not installed and the Resource service is offline`
    case 'RESOURCE_TEMPORARY_UNAVAILABLE':
      return `Bible version ${version} is temporarily unavailable`
    case 'RESOURCE_INTEGRITY_ERROR':
      return `Bible version ${version} failed Resource integrity validation`
    default:
      return `Unknown error loading ${version}`
  }
}

/**
 * Result type for loadBibleChapter that can contain either verses or an error
 */
export type BibleChapterResult<T> =
  | { success: true; data: T }
  | { success: false; error: BibleError }

/**
 * Creates a successful result
 */
export function successResult<T>(data: T): BibleChapterResult<T> {
  return { success: true, data }
}

/**
 * Creates an error result
 */
export function errorResult<T>(error: BibleError): BibleChapterResult<T> {
  return { success: false, error }
}

/**
 * Creates a BibleError object
 */
export function createBibleError(
  type: BibleErrorType,
  version: string,
  book?: number,
  chapter?: number,
  recoveries?: BibleRecoveryAction[]
): BibleError {
  return {
    type,
    version,
    book,
    chapter,
    message: getBibleErrorMessage(type, version, book, chapter),
    ...(recoveries?.length ? { recoveries } : {}),
  }
}
