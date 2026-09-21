/* eslint-disable import/first */
import {
  localDictionaryAccess,
  createHybridDictionaryAccess,
  type DictionaryAccess,
} from '../dictionaryAccess'

jest.mock('expo-file-system/legacy', () => ({ getInfoAsync: jest.fn() }))
jest.mock('~helpers/databases', () => ({
  getDictionaryDbPath: jest.fn(),
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
import { offlineResourceRegistry } from '../resourceAvailability'

it('discovers entries offline with only Bost and Calmet installed using the published directory schema', async () => {
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
    expect(online.discoverPassageEntries).not.toHaveBeenCalled()
    expect(offlineResourceRegistry.markCorrupt).not.toHaveBeenCalled()
  } finally {
    database.close()
  }
})
