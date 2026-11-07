import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { createIsolatedPostgres } from '../../database/__tests__/isolatedPostgresTestSupport'
import {
  LIBRARY_EMBEDDING_CONTRACT,
  LIBRARY_EMBEDDING_DIMENSIONS,
  LIBRARY_EMBEDDING_MODEL,
  type LibraryEmbeddingProvider,
} from '../../search/libraryEmbedding'
import { indexLibrary } from '../libraryIndexRepository'
import { searchLibrary } from '../librarySearchRepository'

const runIntegration = process.env.RESOURCE_INTEGRATION === '1'
const connectionString =
  process.env.RESOURCE_DATABASE_URL ??
  'postgresql://bible_strong:bible_strong@127.0.0.1:54329/bible_strong'

// One axis per idea: passages and queries about the same idea are neighbours.
const axis = (index: number) =>
  Array.from({ length: LIBRARY_EMBEDDING_DIMENSIONS }, (_, position) =>
    position === index ? 1 : 0
  )
const ideaOf = (text: string) =>
  /mill[ée]n/iu.test(text)
    ? 0
    : /alliance|covenant/iu.test(text)
      ? 1
      : /patience/iu.test(text)
        ? 2
        : 3
const embedded: string[] = []
const provider: LibraryEmbeddingProvider = {
  model: LIBRARY_EMBEDDING_MODEL,
  contract: LIBRARY_EMBEDDING_CONTRACT,
  embedDocuments: async texts => {
    embedded.push(...texts)
    return texts.map(text => axis(ideaOf(text)))
  },
  embedQuery: async text => axis(ideaOf(text)),
}

describe('Library search index', { skip: !runIntegration }, () => {
  it('indexes active publications, reuses unchanged vectors and finds passages by meaning and by words', async () => {
    const isolated = await createIsolatedPostgres(connectionString, 'library_index')
    const { database } = isolated
    try {
      const publication = (identity: string, kind: string, language: string, n: number) => ({
        resource_identity: identity,
        resource_kind: kind,
        revision: `${identity.replaceAll(':', '-')}-r1`,
        language,
        status: 'active' as const,
        canonical_sha256: String(n).repeat(64),
        offline_artifact_sha256: String(n + 1).repeat(64),
        provenance: { source: 'integration-test', imported_at: new Date(0).toISOString() },
        rights: { holder: 'integration-test', online: true, offline: true },
        metadata: {},
        activated_at: new Date(0),
      })
      const ids = Object.fromEntries(
        (
          await database
            .insertInto('resource_publications')
            .values([
              publication('commentary:sdabc:fr', 'commentary', 'fr', 1),
              publication('commentary:sdabc:en', 'commentary', 'en', 2),
              publication('commentary:barnes:fr', 'commentary', 'fr', 3),
              publication('dictionary:westphal:fr', 'dictionary', 'fr', 4),
              publication('dictionary:fr', 'dictionary', 'fr', 5),
              publication('nave:fr', 'nave', 'fr', 6),
            ])
            .returning(['id', 'resource_identity'])
            .execute()
        ).map(row => [row.resource_identity, row.id])
      )
      const section = (publicationId: number, id: string, content: string) => ({
        publication_id: publicationId,
        id,
        book: 66,
        chapter: 20,
        range_start_verse: 1,
        range_end_verse: 6,
        excerpt: content.slice(0, 160),
        content,
      })
      await database
        .insertInto('commentary_reading_sections')
        .values([
          section(
            ids['commentary:sdabc:fr'],
            'sdabc-fr-66-20-1',
            '<p>Le millénium commence au retour du Christ.</p>'
          ),
          section(
            ids['commentary:sdabc:en'],
            'sdabc-en-66-20-1',
            '<p>The millennium begins at the return of Christ.</p>'
          ),
          section(
            ids['commentary:barnes:fr'],
            'barnes-fr-66-20-1',
            '<p>Le règne de mille ans selon les millénaristes.</p>'
          ),
        ])
        .execute()
      const entry = (publicationId: number, entryId: number, word: string, definition: string) => ({
        publication_id: publicationId,
        entry_id: entryId,
        word,
        normalized_word: word.toLowerCase(),
        definition,
        payload: {},
      })
      await database
        .insertInto('dictionary_entries')
        .values([
          entry(
            ids['dictionary:westphal:fr'],
            1,
            'Alliance',
            '<p>Pacte conclu entre Dieu et son peuple.</p>'
          ),
          entry(
            ids['dictionary:fr'],
            1,
            'Alliance',
            '<p>Pacte conclu entre Dieu et son peuple.</p>'
          ),
        ])
        .execute()
      await database
        .insertInto('nave_topics')
        .values({
          publication_id: ids['nave:fr'],
          normalized_name: 'patience',
          name: 'Patience',
          initial: 'P',
          description: '<p>Romains 5:3-4; Jacques 1:3.</p>',
        })
        .execute()

      const first = await indexLibrary({ connectionString: isolated.connectionString, provider })
      assert.deepEqual(
        first.map(report => [report.identity, report.passages, report.embedded]),
        [
          ['commentary:barnes:fr', 1, 1],
          ['commentary:sdabc:en', 1, 1],
          ['commentary:sdabc:fr', 1, 1],
          ['dictionary:westphal:fr', 1, 1],
          ['nave:fr', 1, 1],
        ],
        'the legacy dictionary:fr aggregate is not indexed'
      )

      // By meaning, limited to a tradition: one hit for the section, in the reader's language.
      const adventist = await searchLibrary(database, provider, {
        query: 'le millénium',
        traditions: ['Adventiste'],
      })
      assert.equal(adventist.semantic, true)
      assert.deepEqual(
        adventist.hits.map(hit => [hit.work, hit.language, hit.target.sectionId]),
        [['sdabc', 'fr', 'sdabc-fr-66-20-1']]
      )
      const english = await searchLibrary(database, provider, {
        query: 'the millennium',
        languages: ['en', 'fr'],
        traditions: ['Adventiste'],
      })
      assert.equal(english.hits[0].language, 'en')

      // By words: the French stemmer matches « pactes » to « pacte » (the only dictionary
      // passage is also the nearest by meaning, whatever its distance).
      const pacts = await searchLibrary(database, provider, {
        query: 'les pactes',
        corpora: ['dictionary'],
      })
      assert.deepEqual(
        pacts.hits.map(hit => [hit.work, hit.title, hit.matched]),
        [['westphal', 'Alliance', 'both']]
      )
      const wordsOnly = await searchLibrary(
        database,
        {
          ...provider,
          embedQuery: async () => {
            throw new Error('model unavailable')
          },
        },
        { query: 'les pactes' }
      )
      assert.equal(wordsOnly.semantic, false)
      assert.deepEqual(
        wordsOnly.hits.map(hit => [hit.title, hit.matched]),
        [['Alliance', 'lexical']]
      )
      assert.deepEqual(pacts.hits[0].target, {
        kind: 'dictionary',
        work: 'westphal',
        language: 'fr',
        entryId: 1,
      })

      // Filters by passage.
      const chapter = await searchLibrary(database, provider, {
        query: 'millénium',
        book: 66,
        chapter: 20,
        corpora: ['commentary'],
      })
      assert.ok(
        chapter.hits.every(hit => hit.reference?.book === 66 && hit.reference.chapter === 20)
      )
      assert.equal(
        (await searchLibrary(database, provider, { query: 'millénium', book: 1 })).hits.length,
        0
      )

      // A second run embeds nothing; a removed section is deleted; a republication cascades.
      embedded.length = 0
      const second = await indexLibrary({ connectionString: isolated.connectionString, provider })
      assert.equal(embedded.length, 0)
      assert.ok(second.every(report => report.kept === report.passages && report.embedded === 0))
      await database
        .deleteFrom('commentary_reading_sections')
        .where('id', '=', 'barnes-fr-66-20-1')
        .execute()
      const third = await indexLibrary({
        connectionString: isolated.connectionString,
        provider,
        corpora: ['commentary'],
      })
      assert.equal(third.find(report => report.identity === 'commentary:barnes:fr')?.deleted, 1)
      await database.deleteFrom('resource_publications').where('id', '=', ids['nave:fr']).execute()
      const remaining = await database.selectFrom('library_passages').select('corpus').execute()
      assert.deepEqual(remaining.map(row => row.corpus).sort(), [
        'commentary',
        'commentary',
        'dictionary',
      ])
    } finally {
      await isolated.dispose()
    }
  })

  it('leaves out a passage the embedding model keeps refusing, and indexes the rest', async () => {
    const isolated = await createIsolatedPostgres(connectionString, 'library_index_refusal')
    const { database } = isolated
    try {
      const [{ id }] = await database
        .insertInto('resource_publications')
        .values({
          resource_identity: 'dictionary:westphal:fr',
          resource_kind: 'dictionary',
          revision: 'westphal-r1',
          language: 'fr',
          status: 'active',
          canonical_sha256: '7'.repeat(64),
          offline_artifact_sha256: '8'.repeat(64),
          provenance: { source: 'integration-test', imported_at: new Date(0).toISOString() },
          rights: { holder: 'integration-test', online: true, offline: true },
          metadata: {},
          activated_at: new Date(0),
        })
        .returning('id')
        .execute()
      await database
        .insertInto('dictionary_entries')
        .values(
          ['Alliance', 'Refus', 'Patience'].map((word, index) => ({
            publication_id: id,
            entry_id: index + 1,
            word,
            normalized_word: word.toLowerCase(),
            definition: `<p>Article ${word}.</p>`,
            payload: {},
          }))
        )
        .execute()
      let calls = 0
      const refusing: LibraryEmbeddingProvider = {
        ...provider,
        embedDocuments: async texts => {
          calls++
          if (texts.some(text => text.includes('Refus'))) throw new Error('LIBRARY_EMBEDDING_HTTP_500')
          return texts.map(text => axis(ideaOf(text)))
        },
      }
      const [report] = await indexLibrary({ connectionString: isolated.connectionString, provider: refusing })
      assert.equal(report.failed.length, 1)
      assert.equal(report.embedded, 2)
      assert.ok(calls >= 3, 'the batch was cut until the refused passage was alone')
      const rows = await database.selectFrom('library_passages').select('title').execute()
      assert.deepEqual(rows.map(row => row.title).sort(), ['Alliance', 'Patience'])
    } finally {
      await isolated.dispose()
    }
  })
})
