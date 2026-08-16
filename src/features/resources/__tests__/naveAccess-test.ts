import {
  createHttpNaveAccess,
  createHybridNaveAccess,
  localNaveAccess,
  type NaveAccess,
  type NaveVerseTopics,
} from '../naveAccess'
import { ResourceAccessError } from '../resourceAccessError'
import loadNaveItem from '~helpers/loadNaveItem'

jest.mock('~helpers/loadNaveByLetter', () => jest.fn())
jest.mock('~helpers/loadNaveByRandom', () => jest.fn())
jest.mock('~helpers/loadNaveBySearch', () => jest.fn())
jest.mock('~helpers/loadNaveByVerset', () => jest.fn())
jest.mock('~helpers/loadNaveItem', () => jest.fn())
jest.mock('../resourceAvailability', () => ({ getLocalResourceAvailability: jest.fn() }))

const topic = {
  normalizedName: 'amour',
  name: 'Amour',
  initial: 'a',
  description: '<p>Aimer Dieu.</p>',
}

const makeAccess = (overrides: Partial<NaveAccess> = {}): NaveAccess => ({
  getAvailability: jest.fn(async () => ({
    status: 'unavailable' as const,
    reason: 'offline-copy-required' as const,
    recoveries: ['acquire-offline-copy' as const],
  })),
  listByLetter: jest.fn(async () => [topic]),
  search: jest.fn(async () => [topic]),
  loadItem: jest.fn(async () => topic),
  loadByVerse: jest.fn(async (): Promise<NaveVerseTopics> => [[topic], undefined]),
  loadRandom: jest.fn(async () => topic),
  ...overrides,
})

describe('hybrid Nave access', () => {
  it('prefers an installed local copy and does not source-hop after local not-found', async () => {
    const local = makeAccess({
      getAvailability: jest.fn(async () => ({ status: 'available' as const })),
      loadItem: jest.fn(async () => undefined),
    })
    const remote = makeAccess()
    const access = createHybridNaveAccess({
      offline: local,
      online: remote,
      remotelyReadableLanguages: new Set(['fr']),
      isOnline: async () => true,
    })

    await expect(access.listByLetter('a', 'fr')).resolves.toEqual([topic])
    await expect(access.loadItem('absent', 'fr')).resolves.toBeUndefined()
    expect(remote.listByLetter).not.toHaveBeenCalled()
    expect(remote.loadItem).not.toHaveBeenCalled()
  })

  it('uses HTTP with zero copy and exposes online availability without requiring a download', async () => {
    const local = makeAccess()
    const remote = makeAccess()
    const access = createHybridNaveAccess({
      offline: local,
      online: remote,
      remotelyReadableLanguages: new Set(['fr']),
      isOnline: async () => true,
    })

    await expect(access.getAvailability?.('fr')).resolves.toEqual({ status: 'available' })
    await expect(access.loadRandom('fr')).resolves.toEqual(topic)
    expect(remote.loadRandom).toHaveBeenCalledWith('fr')
  })

  it('preserves corrupt-copy recovery when HTTP also fails', async () => {
    const local = makeAccess({
      getAvailability: jest.fn(async () => ({
        status: 'unavailable' as const,
        reason: 'invalid-offline-copy' as const,
        recoveries: ['acquire-offline-copy' as const, 'manage-offline-copies' as const],
      })),
    })
    const remote = makeAccess({
      loadRandom: jest.fn(async () => {
        throw new ResourceAccessError('TEMPORARY_UNAVAILABLE')
      }),
    })
    const access = createHybridNaveAccess({
      offline: local,
      online: remote,
      remotelyReadableLanguages: new Set(['fr']),
      isOnline: async () => true,
    })

    await expect(access.loadRandom('fr')).rejects.toMatchObject({
      code: 'INVALID_OFFLINE_COPY',
      recoveries: ['acquire-offline-copy', 'manage-offline-copies'],
    })
  })

  it('still requires an Offline copy for a language not remotely published', async () => {
    const access = createHybridNaveAccess({
      offline: makeAccess(),
      online: makeAccess(),
      remotelyReadableLanguages: new Set(['fr']),
      isOnline: async () => true,
    })

    await expect(access.getAvailability?.('en')).resolves.toMatchObject({
      status: 'unavailable',
      reason: 'offline-copy-required',
    })
  })

  it('routes search remote-first while connected, local-first offline, and locally after temporary failure', async () => {
    const local = makeAccess({
      getAvailability: jest.fn(async () => ({ status: 'available' as const })),
      search: jest.fn(async () => [{ ...topic, name: 'Local' }]),
    })
    const remote = makeAccess({
      search: jest
        .fn()
        .mockResolvedValueOnce([{ ...topic, name: 'Remote' }])
        .mockRejectedValueOnce(new ResourceAccessError('TEMPORARY_UNAVAILABLE')),
    })
    let connected = true
    const access = createHybridNaveAccess({
      offline: local,
      online: remote,
      remotelyReadableLanguages: new Set(['fr']),
      isOnline: async () => connected,
    })

    await expect(access.search('amour', 'fr')).resolves.toEqual([{ ...topic, name: 'Remote' }])
    await expect(access.search('amour', 'fr')).resolves.toEqual([{ ...topic, name: 'Local' }])
    connected = false
    await expect(access.search('amour', 'fr')).resolves.toEqual([{ ...topic, name: 'Local' }])
    expect(remote.search).toHaveBeenCalledTimes(2)
    expect(local.search).toHaveBeenCalledTimes(2)
  })

  it('passes the requested language to the local SQLite helper', async () => {
    jest.mocked(loadNaveItem).mockResolvedValueOnce(undefined)

    await expect(localNaveAccess.loadItem('faith', 'en')).resolves.toBeUndefined()

    expect(loadNaveItem).toHaveBeenCalledWith('faith', 'en')
  })

  it('preserves corrupt-copy recovery for search while offline', async () => {
    const access = createHybridNaveAccess({
      offline: makeAccess({
        getAvailability: jest.fn(async () => ({
          status: 'unavailable' as const,
          reason: 'invalid-offline-copy' as const,
          recoveries: ['acquire-offline-copy' as const, 'manage-offline-copies' as const],
        })),
      }),
      online: makeAccess(),
      remotelyReadableLanguages: new Set(['fr']),
      isOnline: async () => false,
    })

    await expect(access.search('amour', 'fr')).rejects.toMatchObject({
      code: 'INVALID_OFFLINE_COPY',
      recoveries: ['acquire-offline-copy', 'manage-offline-copies'],
    })
  })
})

describe('HTTP Nave access', () => {
  const response = (body: unknown, status = 200) =>
    Promise.resolve(
      new Response(JSON.stringify(body), {
        status,
        headers: { 'content-type': 'application/json' },
      })
    )

  it('uses every versioned endpoint and decodes the shared contracts', async () => {
    const fetcher = jest
      .fn()
      .mockImplementationOnce(() =>
        response({
          resource: { kind: 'nave', language: 'fr', revision: 'r1' },
          topics: [{ normalizedName: 'amour', name: 'Amour', initial: 'a' }],
        })
      )
      .mockImplementationOnce(() =>
        response({
          resource: { kind: 'nave', language: 'fr', revision: 'r1' },
          topic,
        })
      )
      .mockImplementationOnce(() =>
        response({
          resource: { kind: 'nave', language: 'fr', revision: 'r1' },
          verseKey: '43-3-16',
          verseTopics: [{ normalizedName: 'amour', name: 'Amour' }],
          chapterTopics: [],
        })
      )
      .mockImplementationOnce(() =>
        response({
          resource: { kind: 'nave', language: 'fr', revision: 'r1' },
          topic,
        })
      )
    const access = createHttpNaveAccess({
      baseUrl: 'http://resource.test/',
      fetcher,
      isOnline: async () => true,
    })

    await expect(access.listByLetter('a', 'fr')).resolves.toEqual([
      { normalizedName: 'amour', name: 'Amour', initial: 'a' },
    ])
    await expect(access.loadItem('amour', 'fr')).resolves.toEqual(topic)
    await expect(access.loadByVerse('43-3-16', 'fr')).resolves.toEqual([
      [{ normalizedName: 'amour', name: 'Amour' }],
      [],
    ])
    await expect(access.loadRandom('fr')).resolves.toEqual(topic)
    expect(fetcher.mock.calls.map(([url]) => url)).toEqual([
      'http://resource.test/v1/naves/fr/topics?initial=a',
      'http://resource.test/v1/naves/fr/topics/amour',
      'http://resource.test/v1/naves/fr/verses/43-3-16/topics',
      'http://resource.test/v1/naves/fr/random',
    ])
  })

  it('distinguishes not-found, offline, temporary failure, and malformed content', async () => {
    const notFound = createHttpNaveAccess({
      baseUrl: 'http://resource.test',
      fetcher: jest.fn(() => response({ code: 'NAVE_TOPIC_NOT_FOUND' }, 404)),
      isOnline: async () => true,
    })
    await expect(notFound.loadItem('absent', 'fr')).resolves.toBeUndefined()

    const offline = createHttpNaveAccess({
      baseUrl: 'http://resource.test',
      fetcher: jest.fn(async () => {
        throw new Error('network')
      }),
      isOnline: async () => false,
    })
    await expect(offline.loadRandom('fr')).rejects.toMatchObject({ code: 'NETWORK_OFFLINE' })

    const temporary = createHttpNaveAccess({
      baseUrl: 'http://resource.test',
      fetcher: jest.fn(() => response({ code: 'NAVE_PUBLICATION_INACTIVE' }, 503)),
      isOnline: async () => true,
    })
    await expect(temporary.loadRandom('fr')).rejects.toMatchObject({
      code: 'TEMPORARY_UNAVAILABLE',
    })

    const malformed = createHttpNaveAccess({
      baseUrl: 'http://resource.test',
      fetcher: jest.fn(() => response({ topic: { name: 42 } })),
      isOnline: async () => true,
    })
    await expect(malformed.loadRandom('fr')).rejects.toMatchObject({ code: 'INTEGRITY_FAILURE' })
  })

  it('rejects cross-language and mismatched operation identities', async () => {
    const crossLanguage = createHttpNaveAccess({
      baseUrl: 'http://resource.test',
      fetcher: jest.fn(() =>
        response({
          resource: { kind: 'nave', language: 'en', revision: 'r1' },
          topic,
        })
      ),
      isOnline: async () => true,
    })
    await expect(crossLanguage.loadRandom('fr')).rejects.toMatchObject({
      code: 'INTEGRITY_FAILURE',
    })

    const mismatchedTopic = createHttpNaveAccess({
      baseUrl: 'http://resource.test',
      fetcher: jest.fn(() =>
        response({
          resource: { kind: 'nave', language: 'fr', revision: 'r1' },
          topic,
        })
      ),
      isOnline: async () => true,
    })
    await expect(mismatchedTopic.loadItem('different', 'fr')).rejects.toMatchObject({
      code: 'INTEGRITY_FAILURE',
    })

    const mismatchedVerse = createHttpNaveAccess({
      baseUrl: 'http://resource.test',
      fetcher: jest.fn(() =>
        response({
          resource: { kind: 'nave', language: 'fr', revision: 'r1' },
          verseKey: '43-3-17',
          verseTopics: [],
          chapterTopics: [],
        })
      ),
      isOnline: async () => true,
    })
    await expect(mismatchedVerse.loadByVerse('43-3-16', 'fr')).rejects.toMatchObject({
      code: 'INTEGRITY_FAILURE',
    })
  })
})
