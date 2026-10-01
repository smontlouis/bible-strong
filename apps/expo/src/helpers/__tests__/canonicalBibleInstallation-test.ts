/* eslint-disable import/first */

const mockGetBibleVersionMetadata = jest.fn()

jest.mock('../biblesDb', () => ({
  getBibleVersionMetadata: (...args: unknown[]) => mockGetBibleVersionMetadata(...args),
}))

import {
  isCanonicalBibleSchemaVersion,
  isInstalledBibleCanonical,
} from '../canonicalBibleInstallation'

describe('canonical Bible installation', () => {
  beforeEach(() => jest.clearAllMocks())

  it.each([
    [undefined, false],
    [null, false],
    [0, false],
    [3, false],
    [4, true],
    [5, true],
  ])('treats schema %p as canonical: %p', (schemaVersion, canonical) => {
    expect(isCanonicalBibleSchemaVersion(schemaVersion)).toBe(canonical)
  })

  it('reads the format of the installed copy rather than the publication', async () => {
    mockGetBibleVersionMetadata.mockResolvedValueOnce({ version: 'NBS', schemaVersion: 4 })
    await expect(isInstalledBibleCanonical('NBS')).resolves.toBe(true)

    mockGetBibleVersionMetadata.mockResolvedValueOnce({ version: 'NBS', schemaVersion: 0 })
    await expect(isInstalledBibleCanonical('NBS')).resolves.toBe(false)

    mockGetBibleVersionMetadata.mockResolvedValueOnce(null)
    await expect(isInstalledBibleCanonical('NBS')).resolves.toBe(false)
    expect(mockGetBibleVersionMetadata).toHaveBeenCalledWith('NBS')
  })
})
