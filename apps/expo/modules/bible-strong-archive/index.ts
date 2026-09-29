import { NativeModule, requireOptionalNativeModule } from 'expo-modules-core'

export type ExtractEncryptedArchiveOptions = {
  /** Downloaded encrypted archive, as a path or `file://` URI. */
  sourcePath: string
  /** Directory receiving the extracted entries, as a path or `file://` URI. */
  destinationPath: string
  /** Catalog id, for example `bible:LSG`. */
  resourceId: string
  /** SHA-256 of the plain archive the encrypted copy was produced from. */
  archiveSha256: string
  keyVersion: number
}

export type EncryptedArchiveErrorCode =
  | 'ARCHIVE_MODULE_UNAVAILABLE'
  | 'ARCHIVE_KEY_UNAVAILABLE'
  | 'ARCHIVE_INVALID_REQUEST'
  | 'ARCHIVE_NOT_ENCRYPTED'
  | 'ARCHIVE_EXTRACTION_FAILED'

// Native code returns failures as values: Expo drops the code of thrown native exceptions.
type NativeExtractionResult = { path: string } | { errorCode: string; message: string }

declare class BibleStrongArchiveNativeModule extends NativeModule {
  isKeyAvailable(keyVersion: number): boolean
  extractEncryptedArchive(options: ExtractEncryptedArchiveOptions): Promise<NativeExtractionResult>
}

// Absent on Web, in tests, and on binaries built before the module existed.
const nativeModule =
  requireOptionalNativeModule<BibleStrongArchiveNativeModule>('BibleStrongArchive')

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
export const isEncryptedArchiveSupported = (keyVersion: number): boolean => {
  try {
    return nativeModule?.isKeyAvailable(keyVersion) ?? false
  } catch {
    return false
  }
}

/**
 * Derives the archive password natively and extracts the archive in the same call, so the
 * password never reaches JavaScript (ADR-0065). Resolves to the destination directory.
 */
export const extractEncryptedArchive = async (
  options: ExtractEncryptedArchiveOptions
): Promise<string> => {
  if (!nativeModule) throw new EncryptedArchiveError('ARCHIVE_MODULE_UNAVAILABLE')
  let result: NativeExtractionResult
  try {
    result = await nativeModule.extractEncryptedArchive(options)
  } catch (error) {
    throw new EncryptedArchiveError('ARCHIVE_EXTRACTION_FAILED', error)
  }
  if ('path' in result) return result.path
  throw new EncryptedArchiveError(knownCodeFrom(result.errorCode), new Error(result.message))
}
