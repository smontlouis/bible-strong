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
  | 'DATABASE_CORRUPTED'
  | 'UNKNOWN_ERROR'

export interface BibleError {
  type: BibleErrorType
  version: string
  book?: number
  chapter?: number
  message: string
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
    case 'DATABASE_CORRUPTED':
      return `Database for ${version} appears to be corrupted`
    default:
      return `Unknown error loading ${version}`
  }
}

/**
 * Result type for loadBibleChapter that can contain either verses or an error
 */
export interface BibleChapterResult<T> {
  success: boolean
  data?: T
  error?: BibleError
}

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
  chapter?: number
): BibleError {
  return {
    type,
    version,
    book,
    chapter,
    message: getBibleErrorMessage(type, version, book, chapter),
  }
}
