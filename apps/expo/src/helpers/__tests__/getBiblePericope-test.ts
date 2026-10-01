/* eslint-disable import/first */

const mockGetBibleVersionMetadata = jest.fn()
const mockGetBibleCanonicalHeadingVerses = jest.fn()
const mockLoadPericope = jest.fn()

jest.mock('../biblesDb', () => ({
  getBibleVersionMetadata: (...args: unknown[]) => mockGetBibleVersionMetadata(...args),
  getBibleCanonicalHeadingVerses: (...args: unknown[]) =>
    mockGetBibleCanonicalHeadingVerses(...args),
}))
jest.mock('../loadPericope', () => ({
  loadPericope: (...args: unknown[]) => mockLoadPericope(...args),
}))
jest.mock('../strongBiblePublications', () => ({
  usesCanonicalBibleExtras: (versionId: string) => versionId === 'KJV',
}))

import getBiblePericope from '../getBiblePericope'
import type { VersionCode } from '~state/tabs'

const headingVerse = {
  Livre: 40,
  Chapitre: 5,
  Verset: 1,
  Texte: '',
  Headings: [
    {
      offset: 0,
      order: 0,
      kind: 'pericope',
      type: 'section',
      text: 'Les béatitudes',
      markup: '<h2>Les béatitudes</h2>',
    },
  ],
}

describe('getBiblePericope', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockGetBibleCanonicalHeadingVerses.mockResolvedValue([headingVerse])
    mockLoadPericope.mockResolvedValue({ 40: { 5: { 1: { h2: 'Legacy heading' } } } })
  })

  it.each([4, 5])(
    'reads headings from SQLite for any Bible installed from a schema %i canonical copy',
    async schemaVersion => {
      mockGetBibleVersionMetadata.mockResolvedValue({ version: 'NBS', schemaVersion })

      await expect(getBiblePericope('NBS' as VersionCode)).resolves.toEqual({
        40: { 5: { 1: { h3: 'Les béatitudes' } } },
      })
      expect(mockGetBibleCanonicalHeadingVerses).toHaveBeenCalledWith('NBS')
      expect(mockLoadPericope).not.toHaveBeenCalled()
    }
  )

  it('keeps the side file for a Bible installed from a legacy copy', async () => {
    mockGetBibleVersionMetadata.mockResolvedValue({ version: 'NBS', schemaVersion: 0 })

    await expect(getBiblePericope('NBS' as VersionCode)).resolves.toEqual({
      40: { 5: { 1: { h2: 'Legacy heading' } } },
    })
    expect(mockGetBibleCanonicalHeadingVerses).not.toHaveBeenCalled()
  })

  it('returns no pericope when a legacy copy lacks its side file', async () => {
    mockGetBibleVersionMetadata.mockResolvedValue(null)
    mockLoadPericope.mockResolvedValue(null)

    await expect(getBiblePericope('NBS' as VersionCode)).resolves.toEqual({})
  })

  it('keeps reading SQLite headings for Strong Bibles published canonically', async () => {
    await expect(getBiblePericope('KJV' as VersionCode)).resolves.toEqual({
      40: { 5: { 1: { h3: 'Les béatitudes' } } },
    })
    expect(mockGetBibleVersionMetadata).not.toHaveBeenCalled()
  })
})
