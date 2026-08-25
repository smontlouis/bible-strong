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

import {
  createHttpBibleReadingResourceAccess,
  createHybridBibleReadingResourceAccess,
  localBibleReadingResourceAccess,
} from '../bibleReadingResourceAccess'

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

  it('loads a canonical pericope index through HTTP when the local copy is absent', async () => {
    const fetcher = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        resource: { kind: 'bible-text', versionId: 'LSG', revision: 'lsg-text-r1' },
        verses: [
          {
            book: 1,
            chapter: 1,
            verse: 1,
            headings: [
              {
                offset: 0,
                order: 0,
                kind: 'pericope',
                type: 'section',
                text: 'Creation',
                markup: '<h3>Creation</h3>',
              },
            ],
          },
        ],
      }),
    })
    const access = createHttpBibleReadingResourceAccess({
      baseUrl: 'http://127.0.0.1:8787/',
      fetcher,
      isOnline: async () => true,
    })

    await expect(access.loadPericope('LSG')).resolves.toEqual({
      1: { 1: { 1: { h3: 'Creation' } } },
    })
  })

  it('rejects a malformed pericope response instead of trusting the network payload', async () => {
    const access = createHttpBibleReadingResourceAccess({
      baseUrl: 'http://127.0.0.1:8787',
      fetcher: jest.fn().mockResolvedValue({ ok: true, json: async () => ({ verses: 'bad' }) }),
      isOnline: async () => true,
    })

    await expect(access.loadPericope('LSG')).rejects.toThrow()
  })

  it('prefers an installed pericope and restores HTTP fallback after removal', async () => {
    let installed = true
    const local = {
      ...localBibleReadingResourceAccess,
      getPericopeAvailability: async () =>
        installed
          ? ({ status: 'available' } as const)
          : ({
              status: 'unavailable',
              reason: 'offline-copy-required',
              recoveryIdentity: { kind: 'bible', versionId: 'LSG' },
            } as const),
      loadPericope: jest.fn().mockResolvedValue({ local: {} }),
    }
    const online = {
      getPericopeAvailability: async () => ({ status: 'available' }) as const,
      loadPericope: jest.fn().mockResolvedValue({ remote: {} }),
    }
    const hybrid = createHybridBibleReadingResourceAccess({
      local,
      online,
      remotelyReadableVersions: new Set(['LSG']),
      isOnline: async () => true,
    })

    await expect(hybrid.loadPericope('LSG')).resolves.toEqual({ local: {} })
    installed = false
    await expect(hybrid.loadPericope('LSG')).resolves.toEqual({ remote: {} })
  })
})
