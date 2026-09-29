// Native Offline-copy decryption is unavailable under Jest: installations use plain archives.
// Tests exercising encrypted archives override this module with jest.mock.
class EncryptedArchiveError extends Error {
  constructor(code, cause) {
    super(code)
    this.name = 'EncryptedArchiveError'
    this.code = code
    this.cause = cause
  }
}

module.exports = {
  EncryptedArchiveError,
  isEncryptedArchiveSupported: () => false,
  extractEncryptedArchive: async () => {
    throw new EncryptedArchiveError('ARCHIVE_MODULE_UNAVAILABLE')
  },
}
