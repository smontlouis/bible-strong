const mockNativeModule = {
  isKeyAvailable: jest.fn(),
  extractEncryptedArchive: jest.fn(),
}
let mockModuleAvailable = true

jest.mock('expo-modules-core', () => ({
  NativeModule: class {},
  requireOptionalNativeModule: () => (mockModuleAvailable ? mockNativeModule : null),
}))

const options = {
  sourcePath: 'file:///cache/bible-lsg.json.encrypted.zip',
  destinationPath: 'file:///cache/bible-lsg',
  resourceId: 'bible:LSG',
  archiveSha256: '864fa6992f780fe20cce4f6a660d9545fe20bb1cdc15aea69b1e019370301e21',
  keyVersion: 1,
}

const loadModule = () => {
  let loaded: typeof import('../index') | undefined
  jest.isolateModules(() => {
    loaded = require('../index')
  })
  return loaded!
}

describe('Encrypted Offline-copy archives', () => {
  beforeEach(() => {
    mockModuleAvailable = true
    mockNativeModule.isKeyAvailable.mockReset()
    mockNativeModule.extractEncryptedArchive.mockReset()
  })

  it('reports support only when the binary holds the key version', () => {
    mockNativeModule.isKeyAvailable.mockImplementation((version: number) => version === 1)
    const archive = loadModule()

    expect(archive.isEncryptedArchiveSupported(1)).toBe(true)
    expect(archive.isEncryptedArchiveSupported(2)).toBe(false)
  })

  it('reports no support without the native module', () => {
    mockModuleAvailable = false
    const archive = loadModule()

    expect(archive.isEncryptedArchiveSupported(1)).toBe(false)
    return expect(archive.extractEncryptedArchive(options)).rejects.toMatchObject({
      code: 'ARCHIVE_MODULE_UNAVAILABLE',
    })
  })

  it('passes the request to native code and resolves to the destination', async () => {
    mockNativeModule.extractEncryptedArchive.mockResolvedValue({ path: '/cache/bible-lsg' })
    const archive = loadModule()

    await expect(archive.extractEncryptedArchive(options)).resolves.toBe('/cache/bible-lsg')
    expect(mockNativeModule.extractEncryptedArchive).toHaveBeenCalledWith(options)
  })

  it('keeps known native failure codes and folds unknown failures into extraction failures', async () => {
    const archive = loadModule()
    mockNativeModule.extractEncryptedArchive.mockResolvedValueOnce({
      errorCode: 'ARCHIVE_KEY_UNAVAILABLE',
      message: 'missing',
    })
    await expect(archive.extractEncryptedArchive(options)).rejects.toMatchObject({
      name: 'EncryptedArchiveError',
      code: 'ARCHIVE_KEY_UNAVAILABLE',
    })

    mockNativeModule.extractEncryptedArchive.mockResolvedValueOnce({
      errorCode: 'SOMETHING_NEW',
      message: 'unexpected',
    })
    await expect(archive.extractEncryptedArchive(options)).rejects.toMatchObject({
      code: 'ARCHIVE_EXTRACTION_FAILED',
    })

    mockNativeModule.extractEncryptedArchive.mockRejectedValueOnce(new Error('bridge failure'))
    await expect(archive.extractEncryptedArchive(options)).rejects.toMatchObject({
      code: 'ARCHIVE_EXTRACTION_FAILED',
    })
  })
})
