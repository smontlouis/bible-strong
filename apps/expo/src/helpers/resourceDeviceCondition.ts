/**
 * Native download and file errors that describe the device, not a bug: no network, a request
 * that took too long, a full disk. Android reports them with the class name as code
 * (`FileSystemLegacyModule`) and the Java message; iOS with the NSURLError description.
 */
export type ResourceDeviceConditionCode =
  | 'RESOURCE_OFFLINE'
  | 'RESOURCE_DOWNLOAD_TIMEOUT'
  | 'RESOURCE_STORAGE_FULL'

const errorNames: Record<ResourceDeviceConditionCode, string> = {
  RESOURCE_OFFLINE: 'ResourceOfflineError',
  RESOURCE_DOWNLOAD_TIMEOUT: 'ResourceDownloadTimeoutError',
  RESOURCE_STORAGE_FULL: 'ResourceStorageFullError',
}

const storageFullPattern =
  /ENOSPC|no space left|SQLITE_FULL|database or disk is full|not enough (?:free )?space|isn[’']t enough space/i

const timeoutPattern = /timed? ?out/i

const offlinePattern = new RegExp(
  [
    'unable to resolve host',
    'failed to connect to',
    'software caused connection abort',
    'connection reset',
    'connection closed',
    'connection refused',
    'network is unreachable',
    'no route to host',
    'unexpected end of stream',
    'internet connection appears to be offline',
    'hostname could not be found',
    'could not connect to the server',
    'network connection was lost',
  ].join('|'),
  'i'
)

const errorMessage = (error: unknown) => {
  if (error instanceof Error) return error.message
  if (error && typeof error === 'object' && 'message' in error) {
    const { message } = error as { message?: unknown }
    if (typeof message === 'string') return message
  }
  return typeof error === 'string' ? error : ''
}

const errorCode = (error: unknown) =>
  error && typeof error === 'object' && 'code' in error && typeof error.code === 'string'
    ? error.code
    : undefined

export class ResourceDeviceConditionError extends Error {
  readonly code: ResourceDeviceConditionCode
  readonly nativeCode?: string

  constructor(code: ResourceDeviceConditionCode, cause: unknown) {
    const nativeMessage = errorMessage(cause)
    // The code leads the message, as for `NETWORK_OFFLINE (HTTP 503, …)`: the reader-facing text
    // and the Sentry filter read it from there; the native text stays for diagnosis.
    super(nativeMessage ? `${code} (${nativeMessage})` : code)
    this.name = errorNames[code]
    this.code = code
    this.nativeCode = errorCode(cause)
  }
}

export const isStorageFullError = (error: unknown) =>
  error instanceof ResourceDeviceConditionError
    ? error.code === 'RESOURCE_STORAGE_FULL'
    : storageFullPattern.test(errorMessage(error))

/** Classifies a rejection of the native download. Returns `undefined` for anything else. */
export const classifyDownloadFailure = (
  error: unknown
): ResourceDeviceConditionCode | undefined => {
  if (error instanceof ResourceDeviceConditionError) return error.code
  const message = errorMessage(error)
  if (storageFullPattern.test(message)) return 'RESOURCE_STORAGE_FULL'
  if (offlinePattern.test(message)) return 'RESOURCE_OFFLINE'
  if (timeoutPattern.test(message)) return 'RESOURCE_DOWNLOAD_TIMEOUT'
  return undefined
}

export const asDownloadFailure = (error: unknown): unknown => {
  if (error instanceof ResourceDeviceConditionError) return error
  const code = classifyDownloadFailure(error)
  return code ? new ResourceDeviceConditionError(code, error) : error
}

/** Extraction and SQLite writes can fill the disk too; nothing else is reclassified there. */
export const asStorageFullFailure = (error: unknown): unknown =>
  !(error instanceof ResourceDeviceConditionError) && isStorageFullError(error)
    ? new ResourceDeviceConditionError('RESOURCE_STORAGE_FULL', error)
    : error

/** The reader-facing explanation of a failed download, when its stored error names a condition. */
export const getDownloadFailureMessageKey = (error: string | undefined) => {
  if (!error) return undefined
  if (error.startsWith('RESOURCE_OFFLINE')) return 'app.youAreOffline'
  if (error.startsWith('RESOURCE_DOWNLOAD_TIMEOUT')) return 'downloads.error.timeout'
  if (error.startsWith('RESOURCE_STORAGE_FULL')) return 'downloads.error.storageFull'
  return undefined
}
