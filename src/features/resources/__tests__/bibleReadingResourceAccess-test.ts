/* eslint-disable import/first */

const mockGetLocalResourceAvailability = jest.fn()
const mockUsesCanonicalBibleExtras = jest.fn()
const mockVersionHasPericope = jest.fn()
const mockVersionHasRedWords = jest.fn()

jest.mock('../resourceAvailability', () => ({
  getLocalResourceAvailability: (...args: unknown[]) => mockGetLocalResourceAvailability(...args),
}))
jest.mock('~helpers/strongBiblePublications', () => ({
  usesCanonicalBibleExtras: (...args: unknown[]) => mockUsesCanonicalBibleExtras(...args),
}))
jest.mock('~helpers/pericopes', () => ({
  versionHasPericope: (...args: unknown[]) => mockVersionHasPericope(...args),
}))
jest.mock('~helpers/redWords', () => ({
  versionHasRedWords: (...args: unknown[]) => mockVersionHasRedWords(...args),
}))
jest.mock('~helpers/getBiblePericope', () => jest.fn())
jest.mock('~helpers/loadMhyComments', () => jest.fn())
jest.mock('~helpers/loadRedWords', () => ({ loadRedWords: jest.fn() }))
jest.mock('~helpers/loadTresorReferences', () => jest.fn())

import { localBibleReadingResourceAccess } from '../bibleReadingResourceAccess'

describe('Bible reading secondary-resource availability', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockUsesCanonicalBibleExtras.mockReturnValue(false)
    mockVersionHasPericope.mockReturnValue(true)
    mockVersionHasRedWords.mockReturnValue(true)
  })

  it('recovers a missing canonical pericope index through the parent Bible Offline copy', async () => {
    mockUsesCanonicalBibleExtras.mockReturnValue(true)
    mockGetLocalResourceAvailability.mockResolvedValue({
      status: 'missing',
      resource: { kind: 'bible', versionId: 'LSG' },
    })

    await expect(localBibleReadingResourceAccess.getPericopeAvailability?.('LSG')).resolves.toEqual(
      {
        status: 'unavailable',
        reason: 'offline-copy-required',
        recoveryIdentity: { kind: 'bible', versionId: 'LSG' },
      }
    )
  })

  it('keeps the French-only Matthew Henry capability explicit', async () => {
    await expect(localBibleReadingResourceAccess.getMhyAvailability?.('en')).resolves.toEqual({
      status: 'unsupported',
    })
    expect(mockGetLocalResourceAvailability).not.toHaveBeenCalled()
  })

  it('reports invalid legacy presentation data without hiding it as empty content', async () => {
    mockGetLocalResourceAvailability.mockResolvedValue({
      status: 'invalid',
      resource: { kind: 'bible-pericope', versionId: 'NBS' },
    })

    await expect(localBibleReadingResourceAccess.getPericopeAvailability?.('NBS')).resolves.toEqual(
      {
        status: 'unavailable',
        reason: 'invalid-offline-copy',
        recoveryIdentity: { kind: 'bible', versionId: 'NBS' },
      }
    )
  })

  it('recovers missing red-letter presentation through the parent Bible bundle', async () => {
    mockGetLocalResourceAvailability.mockResolvedValue({
      status: 'missing',
      resource: { kind: 'bible-red-words', versionId: 'NBS' },
    })

    await expect(localBibleReadingResourceAccess.getRedWordsAvailability?.('NBS')).resolves.toEqual(
      {
        status: 'unavailable',
        reason: 'offline-copy-required',
        recoveryIdentity: { kind: 'bible', versionId: 'NBS' },
      }
    )
  })
})
