import {
  createHttpDictionaryAccess,
  createHybridDictionaryAccess,
  type DictionaryAccess,
} from '../dictionaryAccess'

jest.mock('expo-file-system/legacy', () => ({ getInfoAsync: jest.fn() }))
jest.mock('~helpers/databases', () => ({ getDictionaryDbPath: jest.fn() }))
jest.mock('~helpers/sqlite', () => ({ openSQLiteDatabase: jest.fn() }))
jest.mock('~helpers/loadDictionnaireByLetter', () => jest.fn())
jest.mock('~helpers/loadDictionnaireBySearch', () => jest.fn())
jest.mock('~helpers/loadDictionnaireItem', () => jest.fn())
jest.mock('~helpers/loadDictionnaireItems', () => jest.fn())
jest.mock('~helpers/loadDictionnaireItemByRowId', () => jest.fn())
jest.mock('~helpers/loadDictionnaireWords', () => jest.fn())
jest.mock('../resourceAvailability', () => ({ getLocalResourceAvailability: jest.fn() }))

const response = (body: unknown) =>
  Promise.resolve(
    new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  )

describe('HTTP dictionary access', () => {
  it('discovers independently identified dictionaries by language', async () => {
    const dictionaries = [
      {
        resource: { kind: 'dictionary', work: 'bost', language: 'fr', revision: 'r1' },
        resourceId: 'BOST',
        title: 'Dictionnaire de la Bible',
        abbreviation: 'Bost',
        authors: ['Jean-Augustin Bost'],
        description: 'Dictionnaire biblique français.',
        edition: 'Édition numérique Bible Strong',
        source: 'levangile.com',
        attribution: 'Jean-Augustin Bost, source levangile.com',
        onlineAccess: true,
        offlineDownload: true,
      },
    ]
    const fetcher = jest.fn(() => response({ dictionaries }))
    const access = createHttpDictionaryAccess({
      baseUrl: 'http://resource.test',
      fetcher,
      isOnline: async () => true,
    })

    await expect(access.listWorks?.('fr')).resolves.toEqual(dictionaries)
    expect(fetcher).toHaveBeenCalledWith(
      'http://resource.test/v1/dictionaries?language=fr',
      expect.any(Object)
    )
  })

  it('continues browse with the server cursor without offset pagination', async () => {
    const cursor = encodeURIComponent(JSON.stringify(['amour', 42]))
    const fetcher = jest.fn(() =>
      response({
        resource: { kind: 'dictionary', work: 'westphal', language: 'fr', revision: 'r1' },
        entries: [{ id: 43, word: 'Ange', normalizedWord: 'ange' }],
        limit: 1,
        nextCursor: cursor,
      })
    )
    const access = createHttpDictionaryAccess({
      baseUrl: 'http://resource.test',
      fetcher,
      isOnline: async () => true,
    })

    await expect(access.listByLetterPage('a', { limit: 1, cursor }, 'fr')).resolves.toEqual({
      entries: [{ id: 43, word: 'Ange', normalizedWord: 'ange' }],
      nextCursor: cursor,
    })
    expect(fetcher).toHaveBeenCalledWith(
      `http://resource.test/v1/dictionaries/westphal/fr/entries?initial=a&limit=1&cursor=${encodeURIComponent(cursor)}`,
      expect.any(Object)
    )
  })

  it('loads verse definitions through one batch request', async () => {
    const fetcher = jest.fn(() =>
      response({
        resource: { kind: 'dictionary', work: 'westphal', language: 'fr', revision: 'r1' },
        entries: [
          { id: 1, word: 'Amour', definition: 'Définition 1' },
          { id: 2, word: 'Ange', definition: 'Définition 2' },
        ],
      })
    )
    const access = createHttpDictionaryAccess({
      baseUrl: 'http://resource.test',
      fetcher,
      isOnline: async () => true,
    })

    await expect(access.loadItems(['amour', 'ange'], 'fr')).resolves.toHaveLength(2)
    expect(fetcher).toHaveBeenCalledTimes(1)
    expect(fetcher).toHaveBeenCalledWith(
      'http://resource.test/v1/dictionaries/westphal/fr/entries/batch?words=amour%2Cange',
      expect.any(Object)
    )
  })
})

const dictionaryEntry = { id: 1, word: 'Amour', normalizedWord: 'amour' }
const makeDictionaryAccess = (
  availability: 'available' | 'missing',
  label: string
): DictionaryAccess => ({
  getAvailability: jest.fn(async () =>
    availability === 'available'
      ? { status: 'available' as const }
      : {
          status: 'unavailable' as const,
          reason: 'offline-copy-required' as const,
          recoveries: ['acquire-offline-copy' as const],
        }
  ),
  listByLetter: jest.fn(async () => [{ ...dictionaryEntry, word: label }]),
  search: jest.fn(async () => [{ ...dictionaryEntry, word: label }]),
  listByLetterPage: jest.fn(async () => ({ entries: [{ ...dictionaryEntry, word: label }] })),
  searchPage: jest.fn(async () => ({ entries: [{ ...dictionaryEntry, word: label }] })),
  loadItem: jest.fn(async () => ({ word: label, definition: label })),
  loadItems: jest.fn(async () => [{ word: label, definition: label }]),
  loadItemByRowId: jest.fn(async () => ({ word: label })),
  loadWordsForVerse: jest.fn(async () => [label]),
})

describe('hybrid dictionary routing', () => {
  it('prefers an installed local copy while logically offline', async () => {
    const offline = makeDictionaryAccess('available', 'offline')
    const online = makeDictionaryAccess('available', 'online')
    const access = createHybridDictionaryAccess({
      offline,
      online,
      remotelyReadableLanguages: new Set(['fr']),
      isOnline: async () => false,
    })

    await expect(access.loadItemByRowId(1, 'fr')).resolves.toEqual({ word: 'offline' })
    expect(online.loadItemByRowId).not.toHaveBeenCalled()
  })

  it('uses HTTP with no local copy while connected', async () => {
    const online = makeDictionaryAccess('available', 'online')
    const access = createHybridDictionaryAccess({
      offline: makeDictionaryAccess('missing', 'offline'),
      online,
      remotelyReadableLanguages: new Set(['fr']),
      isOnline: async () => true,
    })

    await expect(access.loadItemByRowId(1, 'fr')).resolves.toEqual({ word: 'online' })
  })

  it('does not use HTTP with no local copy while logically offline', async () => {
    const online = makeDictionaryAccess('available', 'online')
    const access = createHybridDictionaryAccess({
      offline: makeDictionaryAccess('missing', 'offline'),
      online,
      remotelyReadableLanguages: new Set(['fr']),
      isOnline: async () => false,
    })

    await expect(access.loadItemByRowId(1, 'fr')).rejects.toMatchObject({
      code: 'NETWORK_OFFLINE',
    })
    expect(online.loadItemByRowId).not.toHaveBeenCalled()
  })

  it('reports network-offline availability with no local copy while logically offline', async () => {
    const access = createHybridDictionaryAccess({
      offline: makeDictionaryAccess('missing', 'offline'),
      online: makeDictionaryAccess('available', 'online'),
      remotelyReadableLanguages: new Set(['fr']),
      isOnline: async () => false,
    })

    await expect(access.getAvailability?.('fr')).resolves.toEqual({
      status: 'unavailable',
      reason: 'network-offline',
      recoveries: ['retry'],
    })
  })

  it('requires an Offline copy for a language that is not remotely readable', async () => {
    const access = createHybridDictionaryAccess({
      offline: makeDictionaryAccess('missing', 'offline'),
      online: makeDictionaryAccess('available', 'online'),
      remotelyReadableLanguages: new Set(['fr']),
      isOnline: async () => true,
    })

    await expect(access.loadItemByRowId(1, 'en')).rejects.toMatchObject({
      code: 'OFFLINE_COPY_REQUIRED',
    })
  })
})
