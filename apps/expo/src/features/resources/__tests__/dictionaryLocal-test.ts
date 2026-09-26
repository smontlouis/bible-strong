/* eslint-disable import/first */
import {
  localDictionaryAccess,
  createHybridDictionaryAccess,
  type DictionaryAccess,
} from '../dictionaryAccess'

jest.mock('expo-file-system/legacy', () => ({ getInfoAsync: jest.fn() }))
jest.mock('~helpers/databases', () => ({
  getDictionaryDbPath: jest.fn(),
  getDbPath: (_id: string, language: string) => `/documents/${language}/dictionnaire.sqlite`,
  getDictionaryDirectoryDbPath: () => '/documents/dictionary-directory.sqlite',
}))
jest.mock('~helpers/sqlite', () => ({ openSQLiteDatabase: jest.fn() }))
jest.mock('~helpers/loadDictionnaireByLetter', () => jest.fn())
jest.mock('~helpers/loadDictionnaireBySearch', () => jest.fn())
jest.mock('~helpers/loadDictionnaireItem', () => jest.fn())
jest.mock('~helpers/loadDictionnaireItems', () => jest.fn())
jest.mock('~helpers/loadDictionnaireItemByRowId', () => jest.fn())
jest.mock('~helpers/loadDictionnaireWords', () => jest.fn())
jest.mock('../resourceAvailability', () => ({
  getLocalResourceAvailability: jest.fn(),
  offlineResourceRegistry: {
    getSnapshot: jest.fn(),
    getAvailability: jest.fn(),
    markCorrupt: jest.fn(),
  },
}))

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { openSQLiteDatabase } from '~helpers/sqlite'
import { getDictionaryDbPath } from '~helpers/databases'
import { getLocalResourceAvailability, offlineResourceRegistry } from '../resourceAvailability'

it('discovers entries offline with only Bost and Calmet installed using the published directory schema', async () => {
  jest.mocked(getLocalResourceAvailability).mockResolvedValue({ status: 'missing' } as never)
  const schemaSource = readFileSync(
    resolve(
      __dirname,
      '../../../../../resource-studio/workflows/dictionaries/scripts/build-directory.mjs'
    ),
    'utf8'
  )
  const schema = schemaSource.match(/const schemaSql = `([\s\S]*?)`;/)![1]
  const database = new DatabaseSync(':memory:')
  database.exec(schema)
  database.exec(`
    INSERT INTO dictionary_works VALUES (1, 'bost', 'BOST', 'fr', 'Bost', 'Bost');
    INSERT INTO dictionary_works VALUES (2, 'calmet', 'CALMET', 'fr', 'Calmet', 'Calmet');
    INSERT INTO dictionary_works VALUES (3, 'westphal', 'WESTPHAL', 'fr', 'Westphal', 'Westphal');
    INSERT INTO dictionary_entries VALUES (1, 10, 'fr', 'Création', 'creation');
    INSERT INTO dictionary_entries VALUES (2, 20, 'fr', 'Dieu', 'dieu');
    INSERT INTO dictionary_entries VALUES (2, 21, 'fr', 'Création', 'creation');
    INSERT INTO dictionary_correspondences VALUES (1, 'creation', 'Création');
    INSERT INTO dictionary_correspondence_members VALUES (1, 1, 10, 0);
    INSERT INTO dictionary_correspondence_members VALUES (1, 2, 21, 1);
    INSERT INTO dictionary_entries VALUES (3, 30, 'fr', 'Terre', 'terre');
    INSERT INTO dictionary_passage_anchors VALUES ('1-1-1', 1, 10, 1, 0);
    INSERT INTO dictionary_passage_anchors VALUES ('1-1-1', 2, 20, 2, 0);
    INSERT INTO dictionary_passage_anchors VALUES ('1-1-1', 3, 30, 1, 0);
  `)
  const installed = ['bost', 'calmet'].map(work => ({
    resource: { kind: 'dictionary', work, resourceId: work.toUpperCase(), language: 'fr' },
    availability: { status: 'available' },
    installedRevision: 'installed',
  }))
  jest.mocked(offlineResourceRegistry.getSnapshot).mockReturnValue({
    resources: new Map(installed.map(entry => [entry.resource.work, entry])),
  } as never)
  jest
    .mocked(offlineResourceRegistry.getAvailability)
    .mockResolvedValue({ status: 'available' } as never)
  jest.mocked(openSQLiteDatabase).mockResolvedValue({
    getAllAsync: async (sql: string, ...params: string[]) => database.prepare(sql).all(...params),
    closeAsync: async () => {},
  } as never)
  const online = { discoverPassageEntries: jest.fn() } as unknown as DictionaryAccess
  const access = createHybridDictionaryAccess({
    offline: localDictionaryAccess,
    online,
    remotelyReadableLanguages: new Set(['fr']),
    isOnline: async () => false,
  })
  try {
    const entries = await access.discoverPassageEntries('1-1-1', 'fr')
    expect(entries.map(entry => [entry.resource.work, entry.id, entry.evidenceKind])).toEqual([
      ['bost', 10, 'source-citation'],
      ['calmet', 20, 'verse-name'],
    ])
    const page = await access.browseDirectoryPage('c', { limit: 1 }, 'fr')
    expect(page.entries.map(entry => entry.label)).toEqual(['Création'])
    expect(page.entries[0].sources.map(source => source.resource.work)).toEqual(['bost', 'calmet'])
    const first = await access.searchDirectoryPage('i', { limit: 1 }, 'fr')
    expect(first.entries.map(entry => entry.label)).toEqual(['Création'])
    expect(first.nextCursor).toBeDefined()
    const second = await access.searchDirectoryPage(
      'i',
      { limit: 1, cursor: first.nextCursor },
      'fr'
    )
    expect(second.entries.map(entry => entry.label)).toEqual(['Dieu'])
    expect(second.nextCursor).toBeUndefined()
    const search = await access.searchDirectoryPage('dieu', {}, 'fr')
    expect(search.entries.map(entry => entry.label)).toEqual(['Dieu'])
    expect(online.discoverPassageEntries).not.toHaveBeenCalled()
    expect(offlineResourceRegistry.markCorrupt).not.toHaveBeenCalled()
  } finally {
    database.close()
  }
})

describe('downloaded dictionaries without network access', () => {
  let database: DatabaseSync
  const resource = {
    kind: 'dictionary',
    work: 'westphal',
    resourceId: 'WESTPHAL',
    language: 'fr',
  } as const
  const online = {
    listByLetterPage: jest.fn(),
    loadItem: jest.fn(),
    browseDirectoryPage: jest.fn(),
  } as unknown as DictionaryAccess
  const access = createHybridDictionaryAccess({
    offline: localDictionaryAccess,
    online,
    remotelyReadableLanguages: new Set(['fr', 'en']),
    isOnline: async () => false,
  })
  beforeEach(() => {
    jest.clearAllMocks()
    database = new DatabaseSync(':memory:')
    database.exec(
      "CREATE TABLE dictionnaire (id INTEGER PRIMARY KEY, word TEXT, sanitized_word TEXT, definition TEXT); INSERT INTO dictionnaire VALUES (1,'Aaron','aaron','First'),(2,'Abel','abel','Second'),(3,'Adam','adam','Third')"
    )
    jest.mocked(offlineResourceRegistry.getSnapshot).mockReturnValue({
      resources: new Map([['westphal', { resource, availability: { status: 'available' } }]]),
    } as never)
    jest.mocked(offlineResourceRegistry.getAvailability).mockImplementation(
      async identity =>
        ({
          status: identity.kind === 'dictionary' ? 'available' : 'missing',
          resource: identity,
        }) as never
    )
    jest.mocked(getLocalResourceAvailability).mockResolvedValue({ status: 'missing' } as never)
    jest
      .mocked(getDictionaryDbPath)
      .mockImplementation((work, language) => `/documents/${language}/${work}.sqlite`)
    jest.mocked(openSQLiteDatabase).mockResolvedValue({
      getAllAsync: async (sql: string, ...params: string[]) => database.prepare(sql).all(...params),
      getFirstAsync: async (sql: string, ...params: string[]) =>
        database.prepare(sql).get(...params),
      closeAsync: async () => {},
    } as never)
  })
  afterEach(() => database.close())
  it('reads the installed default dictionary without an explicit work', async () => {
    expect(await access.getAvailability!('fr')).toEqual({ status: 'available' })
    expect(await access.loadItem('Aaron', 'fr')).toMatchObject({ definition: 'First' })
    expect((await access.listByLetterPage('a', {}, 'fr')).entries).toHaveLength(3)
    expect(online.loadItem).not.toHaveBeenCalled()
  })
  it('reads a legacy download in the requested language even with modern catalog entries', async () => {
    jest
      .mocked(offlineResourceRegistry.getAvailability)
      .mockResolvedValue({ status: 'missing' } as never)
    jest.mocked(getLocalResourceAvailability).mockImplementation(
      async identity =>
        ({
          status: 'language' in identity && identity.language === 'fr' ? 'available' : 'missing',
          resource: identity,
        }) as never
    )
    expect(await access.getAvailability!('fr', 'westphal')).toEqual({ status: 'available' })
    expect(await access.loadItem('Aaron', 'fr', 'westphal')).toMatchObject({ definition: 'First' })
    expect(openSQLiteDatabase).toHaveBeenCalledWith(
      'dictionnaire.sqlite',
      { useNewConnection: true },
      '/documents/fr'
    )
  })
  it('browses and searches installed works without the directory, with stable pagination', async () => {
    expect(await access.getDirectoryAvailability!()).toEqual({ status: 'available' })
    const first = await access.browseDirectoryPage('a', { limit: 2 }, 'fr')
    expect(first.entries.map(item => item.label)).toEqual(['Aaron', 'Abel'])
    expect(first.nextCursor).toBeDefined()
    const second = await access.browseDirectoryPage(
      'a',
      { limit: 2, cursor: first.nextCursor },
      'fr'
    )
    expect(second.entries.map(item => item.label)).toEqual(['Adam'])
    expect(second.nextCursor).toBeUndefined()
    expect(
      (await access.searchDirectoryPage('abel', {}, 'fr')).entries.map(item => item.label)
    ).toEqual(['Abel'])
    expect(online.browseDirectoryPage).not.toHaveBeenCalled()
  })
  it('browses a legacy copy even when the shared index exists', async () => {
    jest.mocked(offlineResourceRegistry.getAvailability).mockImplementation(
      async identity =>
        ({
          status: identity.kind === 'dictionary-directory' ? 'available' : 'missing',
          resource: identity,
        }) as never
    )
    jest.mocked(getLocalResourceAvailability).mockImplementation(
      async identity =>
        ({
          status:
            'language' in identity && 'language' in identity && identity.language === 'fr'
              ? 'available'
              : 'missing',
          resource: identity,
        }) as never
    )
    const page = await access.browseDirectoryPage('a', {}, 'fr')
    expect(page.entries.map(item => item.label)).toEqual(['Aaron', 'Abel', 'Adam'])
    expect(openSQLiteDatabase).toHaveBeenCalledWith(
      'dictionnaire.sqlite',
      { useNewConnection: true },
      '/documents/fr'
    )
  })
  it('paginates across identical words in several installed dictionaries without duplicates', async () => {
    const resources = ['bost', 'westphal'].map(work => ({
      resource: { ...resource, work },
      availability: { status: 'available' },
    }))
    jest.mocked(offlineResourceRegistry.getSnapshot).mockReturnValue({
      resources: new Map(resources.map(item => [item.resource.work, item])),
    } as never)
    const collected: string[] = []
    let cursor: string | undefined
    for (let page = 0; page < 10; page++) {
      const result = await access.browseDirectoryPage('a', { limit: 1, cursor }, 'fr')
      collected.push(
        ...result.entries.map(item => `${item.label}:${item.sources[0].resource.work}`)
      )
      cursor = result.nextCursor
      if (!cursor) break
    }
    expect(collected).toEqual([
      'Aaron:bost',
      'Aaron:westphal',
      'Abel:bost',
      'Abel:westphal',
      'Adam:bost',
      'Adam:westphal',
    ])
  })
  it('uses the English default copy and does not fall back to a French download', async () => {
    jest
      .mocked(offlineResourceRegistry.getAvailability)
      .mockResolvedValue({ status: 'missing' } as never)
    jest.mocked(getLocalResourceAvailability).mockImplementation(
      async identity =>
        ({
          status: 'language' in identity && identity.language === 'en' ? 'available' : 'missing',
          resource: identity,
        }) as never
    )
    expect(await access.loadItem('Aaron', 'en')).toMatchObject({ definition: 'First' })
    expect(openSQLiteDatabase).toHaveBeenCalledWith(
      'dictionnaire.sqlite',
      { useNewConnection: true },
      '/documents/en'
    )
    expect(await access.getAvailability!('fr')).toMatchObject({ status: 'unavailable' })
  })
  it('prefers the modern installed copy over the legacy file', async () => {
    jest.mocked(getLocalResourceAvailability).mockResolvedValue({ status: 'available' } as never)
    expect(await access.loadEntryById(1, 'fr')).toMatchObject({ definition: 'First' })
    expect(openSQLiteDatabase).toHaveBeenCalledWith(
      'westphal.sqlite',
      { useNewConnection: true },
      '/documents/fr'
    )
    expect(getLocalResourceAvailability).not.toHaveBeenCalled()
  })
  it('reports corrupt copies explicitly instead of pretending they are missing', async () => {
    jest
      .mocked(offlineResourceRegistry.getAvailability)
      .mockResolvedValue({ status: 'corrupt' } as never)
    expect(await access.getAvailability!('fr')).toMatchObject({
      status: 'unavailable',
      reason: 'invalid-offline-copy',
    })
  })
})
