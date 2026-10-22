import {
  asDownloadFailure,
  asStorageFullFailure,
  classifyDownloadFailure,
  getDownloadFailureMessageKey,
  ResourceDeviceConditionError,
} from '../resourceDeviceCondition'

const androidDownloadError = (message: string) =>
  Object.assign(new Error(message), { code: 'FileSystemLegacyModule' })

describe('resource device conditions', () => {
  it.each([
    'Unable to resolve host "api.bible-strong.app": No address associated with hostname',
    'Unable to resolve host "0": No address associated with hostname',
    'Failed to connect to api.bible-strong.app/172.67.157.217:443',
    'Software caused connection abort',
    'Connection reset',
    'Connection closed by peer',
    'connection closed',
    'The Internet connection appears to be offline.',
    'A server with the specified hostname could not be found.',
    'The network connection was lost.',
  ])('reads "%s" as a lost connection', message => {
    expect(classifyDownloadFailure(androidDownloadError(message))).toBe('RESOURCE_OFFLINE')
  })

  it.each(['timeout', 'Read timed out', 'The request timed out.'])(
    'reads "%s" as a download that took too long',
    message => {
      expect(classifyDownloadFailure(androidDownloadError(message))).toBe(
        'RESOURCE_DOWNLOAD_TIMEOUT'
      )
    }
  )

  it('reads a full disk before anything else in the message', () => {
    expect(
      classifyDownloadFailure(
        androidDownloadError('write failed: ENOSPC (No space left on device)')
      )
    ).toBe('RESOURCE_STORAGE_FULL')
  })

  it('leaves other failures as they are', () => {
    const error = androidDownloadError('unknown')

    expect(classifyDownloadFailure(error)).toBeUndefined()
    expect(asDownloadFailure(error)).toBe(error)
  })

  it('leads the message with the code and keeps the native text and code', () => {
    const error = asDownloadFailure(androidDownloadError('Connection reset'))

    expect(error).toBeInstanceOf(ResourceDeviceConditionError)
    expect(error).toMatchObject({
      code: 'RESOURCE_OFFLINE',
      name: 'ResourceOfflineError',
      message: 'RESOURCE_OFFLINE (Connection reset)',
      nativeCode: 'FileSystemLegacyModule',
    })
  })

  it('reclassifies only a full disk after the download', () => {
    const offline = new Error('Unable to resolve host "api.bible-strong.app"')

    expect(asStorageFullFailure(offline)).toBe(offline)
    expect(asStorageFullFailure(new Error('database or disk is full'))).toMatchObject({
      code: 'RESOURCE_STORAGE_FULL',
    })
  })

  it.each([
    ['RESOURCE_OFFLINE (Connection reset)', 'app.youAreOffline'],
    ['RESOURCE_DOWNLOAD_TIMEOUT', 'downloads.error.timeout'],
    ['RESOURCE_STORAGE_FULL (write failed: ENOSPC)', 'downloads.error.storageFull'],
    ['ARCHIVE_EXTRACTION_FAILED', undefined],
    [undefined, undefined],
  ])('explains the stored failure %s to the reader', (error, key) => {
    expect(getDownloadFailureMessageKey(error)).toBe(key)
  })
})
