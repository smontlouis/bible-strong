import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { Effect } from 'effect'
import initSqlJs from 'sql.js'

import { createIsolatedPostgres } from '../../database/__tests__/isolatedPostgresTestSupport'
import { makeKyselyDictionaryRepository } from '../dictionaryRepository'
import { readDictionaryDirectoryVersePresences } from '../publicationImporter'

const runIntegration = process.env.RESOURCE_INTEGRATION === '1'
const connectionString =
  process.env.RESOURCE_DATABASE_URL ??
  'postgresql://bible_strong:bible_strong@127.0.0.1:54329/bible_strong'

describe('Dictionary directory publication import', () => {
  it('imports only exact verse presences while preserving the source entry identity', async () => {
    const SQL = await initSqlJs()
    const database = new SQL.Database()
    try {
      database.run(`
        CREATE TABLE dictionary_works (
          work_key INTEGER PRIMARY KEY, work TEXT, resource_id TEXT, language TEXT,
          title TEXT, abbreviation TEXT
        );
        CREATE TABLE dictionary_entries (
          work_key INTEGER, entry_id INTEGER, language TEXT, word TEXT, normalized_word TEXT
        );
        CREATE TABLE dictionary_anchor_evidence (
          evidence_key INTEGER PRIMARY KEY, evidence_kind TEXT
        );
        CREATE TABLE dictionary_passage_anchors (
          verse_key TEXT, work_key INTEGER, entry_id INTEGER, evidence_key INTEGER, ordinal INTEGER
        );
        CREATE TABLE dictionary_correspondences (
          correspondence_key INTEGER PRIMARY KEY, correspondence_id TEXT, label TEXT
        );
        CREATE TABLE dictionary_correspondence_members (
          correspondence_key INTEGER, work_key INTEGER, entry_id INTEGER, ordinal INTEGER
        );
        INSERT INTO dictionary_works VALUES
          (1, 'westphal', 'WESTPHAL', 'fr', 'Dictionnaire encyclopédique', 'Westphal');
        INSERT INTO dictionary_entries VALUES (1, 43, 'fr', 'Dieu', 'dieu');
        INSERT INTO dictionary_anchor_evidence VALUES
          (1, 'source-citation'), (2, 'verse-name'), (3, 'verse-phrase');
        INSERT INTO dictionary_passage_anchors VALUES
          ('1-1-1', 1, 43, 1, 0), ('1-1-1', 1, 43, 2, 1);
        INSERT INTO dictionary_correspondences VALUES (1, 'dictionary-correspondence-god', 'Dieu');
        INSERT INTO dictionary_correspondence_members VALUES (1, 1, 43, 0);
      `)

      const presences = await readDictionaryDirectoryVersePresences(database.export())

      assert.deepEqual(presences, [
        {
          verse_key: '1-1-1',
          work: 'westphal',
          language: 'fr',
          resource_id: 'WESTPHAL',
          title: 'Dictionnaire encyclopédique',
          abbreviation: 'Westphal',
          entry_id: 43,
          word: 'Dieu',
          normalized_word: 'dieu',
          correspondence_id: 'dictionary-correspondence-god',
          evidence_kind: 'verse-name',
        },
      ])
    } finally {
      database.close()
    }
  })
})

describe('Dictionary passage discovery', { skip: !runIntegration }, () => {
  it('merges source citations with exact presences from the active directory', async () => {
    const isolated = await createIsolatedPostgres(
      connectionString,
      'dictionary_directory_discovery'
    )
    const { database } = isolated
    try {
      const publications = await database
        .insertInto('resource_publications')
        .values([
          {
            resource_identity: 'dictionary:westphal:fr',
            resource_kind: 'dictionary',
            revision: 'westphal-r1',
            language: 'fr',
            status: 'active' as const,
            canonical_sha256: '1'.repeat(64),
            offline_artifact_sha256: '2'.repeat(64),
            provenance: { source: 'test', imported_at: new Date(0).toISOString() },
            rights: { holder: 'test', online: true, offline: true },
            metadata: {
              resource_id: 'WESTPHAL',
              title: 'Dictionnaire encyclopédique',
              abbreviation: 'Westphal',
            },
          },
          {
            resource_identity: 'dictionary-directory',
            resource_kind: 'dictionary-directory',
            revision: 'directory-r1',
            language: 'mul',
            status: 'active' as const,
            canonical_sha256: '3'.repeat(64),
            offline_artifact_sha256: '4'.repeat(64),
            provenance: { source: 'test', imported_at: new Date(0).toISOString() },
            rights: { holder: 'test', online: true, offline: true },
            metadata: {},
          },
        ])
        .returning(['id', 'resource_identity'])
        .execute()
      const workPublication = publications.find(
        publication => publication.resource_identity === 'dictionary:westphal:fr'
      )!
      const directoryPublication = publications.find(
        publication => publication.resource_identity === 'dictionary-directory'
      )!

      await database
        .insertInto('dictionary_entries')
        .values({
          publication_id: workPublication.id,
          entry_id: 43,
          word: 'Dieu',
          normalized_word: 'dieu',
          definition: 'Définition',
          correspondence_id: 'dictionary-correspondence-god',
          payload: {},
        })
        .execute()
      await database
        .insertInto('dictionary_verse_links')
        .values({
          publication_id: workPublication.id,
          verse_key: '1-1-1',
          ordinal: 0,
          word: 'Dieu',
          normalized_word: 'dieu',
          entry_id: 43,
          evidence_kind: 'source-citation',
        })
        .execute()
      await database
        .insertInto('dictionary_directory_verse_presences')
        .values({
          publication_id: directoryPublication.id,
          verse_key: '1-1-1',
          work: 'westphal',
          language: 'fr',
          resource_id: 'WESTPHAL',
          title: 'Dictionnaire encyclopédique',
          abbreviation: 'Westphal',
          entry_id: 43,
          word: 'Dieu',
          normalized_word: 'dieu',
          correspondence_id: 'dictionary-correspondence-god',
          evidence_kind: 'verse-name',
        })
        .execute()

      const result = await Effect.runPromise(
        makeKyselyDictionaryRepository(database).discoverPassageEntries({
          verseKey: '1-1-1',
          language: 'fr',
        })
      )

      assert.deepEqual(
        result.map(entry => entry.evidenceKind),
        ['verse-name', 'source-citation']
      )
      assert.ok(
        result.every(entry => entry.work === 'westphal' && entry.revision === 'westphal-r1')
      )
    } finally {
      await isolated.dispose()
    }
  })
})
