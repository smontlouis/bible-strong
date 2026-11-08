/**
 * The desktop app's `bible-strong-archive` (ADR-0065, ADR-0107): the shell derives the password
 * and extracts the archive in Rust (`apps/desktop/src-tauri/src/archive.rs`), so the password
 * never reaches JavaScript. Same contract as `index.ts`.
 */
import { desktopBootstrap } from '../../src/desktop/bridge'
import { call, toFileUri } from '../../src/desktop/call'
import type { EncryptedArchiveErrorCode, ExtractEncryptedArchiveOptions } from './index'

export type { EncryptedArchiveErrorCode, ExtractEncryptedArchiveOptions }

type NativeExtractionResult = { path: string } | { errorCode: string; message: string }

const KNOWN_CODES: readonly EncryptedArchiveErrorCode[] = [
  'ARCHIVE_KEY_UNAVAILABLE',
  'ARCHIVE_INVALID_REQUEST',
  'ARCHIVE_NOT_ENCRYPTED',
  'ARCHIVE_EXTRACTION_FAILED',
]

export class EncryptedArchiveError extends Error {
  constructor(
    readonly code: EncryptedArchiveErrorCode,
    readonly cause?: unknown
  ) {
    super(code)
    this.name = 'EncryptedArchiveError'
  }
}

const knownCodeFrom = (nativeCode: string): EncryptedArchiveErrorCode =>
  KNOWN_CODES.find(known => nativeCode === known) ?? 'ARCHIVE_EXTRACTION_FAILED'

/** Whether this binary can decrypt archives published with `keyVersion`. */
export const isEncryptedArchiveSupported = (keyVersion: number): boolean =>
  desktopBootstrap().archiveKeyVersions.includes(keyVersion)

export const extractEncryptedArchive = async (
  options: ExtractEncryptedArchiveOptions
): Promise<string> => {
  let result: NativeExtractionResult
  try {
    result = await call<NativeExtractionResult>('archive_extract_encrypted', {
      options: {
        ...options,
        sourcePath: toFileUri(options.sourcePath),
        destinationPath: toFileUri(options.destinationPath),
      },
    })
  } catch (error) {
    throw new EncryptedArchiveError('ARCHIVE_EXTRACTION_FAILED', error)
  }
  if ('path' in result) return options.destinationPath
  throw new EncryptedArchiveError(knownCodeFrom(result.errorCode), new Error(result.message))
}
