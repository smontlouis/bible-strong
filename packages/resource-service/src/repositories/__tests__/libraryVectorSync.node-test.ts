import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import type { PoolClient } from 'pg'

import { libraryVectorId } from '../../search/libraryVectorIndex'
import {
  libraryVectorDifference,
  libraryVectorUpsertOf,
  reconcileLibraryVectors,
  syncLibraryVectors,
  type LibraryVectorStore,
  type LibraryVectorUpsert,
} from '../libraryVectorSync'

type Row = {
  publication_id: number
  passage_key: string
  language: 'fr' | 'en'
  active: boolean
}

const longKey = `${'x'.repeat(70)}#0`
const passages: Row[] = [
  { publication_id: 1, passage_key: 'barnes/1/1/1#0', language: 'fr', active: true },
  { publication_id: 1, passage_key: 'barnes/1/1/2#0', language: 'fr', active: true },
  { publication_id: 2, passage_key: longKey, language: 'en', active: true },
  { publication_id: 3, passage_key: 'staged#0', language: 'en', active: false },
]

/** Answers the two queries of the synchronisation from `passages`. */
const fakeClient = (rows: readonly Row[]) =>
  ({
    async query(text: string, params: unknown[]) {
      if (text.includes('join resource_publications'))
        return {
          rows: rows
            .filter(row => row.active && (params[0] as string[]).includes(row.language))
            .map(({ active: _active, ...key }) => key),
        }
      if (text.includes('unnest')) {
        const [ids, keys] = params as [number[], string[]]
        return {
          rows: rows
            .filter(row => ids.some((id, index) => id === row.publication_id && keys[index] === row.passage_key))
            .map(row => ({
              ...row,
              work: 'barnes',
              corpus: row.passage_key.startsWith('x') ? 'document' : 'commentary',
              tradition: 'Protestantisme',
              tags: ['Adventiste'],
              book: row.passage_key.startsWith('x') ? null : 1,
              chapter: row.passage_key.startsWith('x') ? null : 1,
              labelled: !row.passage_key.startsWith('x'),
              embedding: '[0.5,-0.25]',
            })),
        }
      }
      throw new Error(`unexpected query ${text}`)
    },
  }) as unknown as PoolClient

const fakeStore = (present: Record<'fr' | 'en', string[]>) => {
  const calls = {
    upserted: [] as [string, LibraryVectorUpsert[]][],
    deleted: [] as [string, readonly string[]][],
  }
  const store: LibraryVectorStore = {
    async upsert(language, records) {
      calls.upserted.push([language, [...records]])
    },
    async delete(language, ids) {
      calls.deleted.push([language, ids])
    },
    async *listIds(language) {
      // Two pages, as the REST listing gives them.
      const ids = present[language]
      yield ids.slice(0, 1)
      yield ids.slice(1)
    },
  }
  return { store, calls }
}

describe('library vectors synchronisation', () => {
  it('compares the identifiers Neon expects with those an index holds', () => {
    const expected = new Map([
      ['1:a#0', { publication_id: 1, passage_key: 'a#0' }],
      ['1:b#0', { publication_id: 1, passage_key: 'b#0' }],
    ])
    assert.deepEqual(libraryVectorDifference(expected, new Set(['1:b#0', '9:old#0'])), {
      missing: [{ publication_id: 1, passage_key: 'a#0' }],
      extra: ['9:old#0'],
    })
  })

  it('builds a record from a passage row', () => {
    const record = libraryVectorUpsertOf({
      publication_id: 2,
      passage_key: longKey,
      language: 'en',
      work: 'bri',
      corpus: 'document',
      tradition: 'Protestantisme',
      tags: ['Adventiste'],
      book: null,
      chapter: null,
      labelled: false,
      embedding: '[0.5,-0.25]',
    })
    assert.equal(record.id, libraryVectorId(2, longKey))
    assert.deepEqual(record.values, [0.5, -0.25])
    assert.equal(record.metadata.perspective, 'adventist')
    assert.equal(record.metadata.labelled, false)
    assert.equal('book' in record.metadata, false)
  })

  it('deletes what Neon no longer holds and upserts what the index lacks', async () => {
    const { store, calls } = fakeStore({
      fr: ['1:barnes/1/1/1#0', '7:old#0', '7:old#1'],
      en: [libraryVectorId(2, longKey)],
    })
    const report = await reconcileLibraryVectors(fakeClient(passages), store, {
      refresh: [{ publication_id: 2, passage_key: longKey }],
    })
    assert.deepEqual(report.fr, { passages: 2, vectors: 3, missing: 1, extra: 2, upserted: 1, deleted: 2 })
    // A staged passage is not expected; a refreshed one is upserted though present.
    assert.deepEqual(report.en, { passages: 1, vectors: 1, missing: 0, extra: 0, upserted: 1, deleted: 0 })
    assert.deepEqual(calls.deleted, [['fr', ['7:old#0', '7:old#1']]])
    assert.deepEqual(
      calls.upserted.map(([language, records]) => [language, records.map(record => record.id)]),
      [
        ['fr', ['1:barnes/1/1/2#0']],
        ['en', [libraryVectorId(2, longKey)]],
      ]
    )
  })

  it('changes nothing in a dry run, and stops before emptying an index', async () => {
    const dry = fakeStore({ fr: ['7:old#0'], en: [] })
    const report = await reconcileLibraryVectors(fakeClient(passages), dry.store, {
      dryRun: true,
      languages: ['fr'],
    })
    assert.equal(report.fr.extra, 1)
    assert.deepEqual([dry.calls.deleted, dry.calls.upserted], [[], []])

    // A local database compared with the production index: most of it would go.
    const old = Array.from({ length: 1500 }, (_, index) => `7:old#${index}`)
    const stale = fakeStore({ fr: [...old, '1:barnes/1/1/1#0'], en: [] })
    await assert.rejects(
      reconcileLibraryVectors(fakeClient(passages), stale.store, { languages: ['fr'] }),
      /LIBRARY_VECTOR_MASS_DELETE fr: 1500 of 1501/u
    )
    assert.equal(stale.calls.deleted.length, 0)
    await reconcileLibraryVectors(fakeClient(passages), stale.store, {
      languages: ['fr'],
      allowMassDelete: true,
    })
    // By requests of at most 100 identifiers.
    assert.deepEqual(
      stale.calls.deleted.map(([, ids]) => ids.length),
      Array.from({ length: 15 }, () => 100)
    )
  })

  it('syncs the passages a writer reports, each in the index of its language', async () => {
    const { store, calls } = fakeStore({ fr: [], en: [] })
    const result = await syncLibraryVectors(fakeClient(passages), store, {
      upserted: [
        { publication_id: 1, passage_key: 'barnes/1/1/1#0' },
        { publication_id: 2, passage_key: longKey },
        // Refused by Workers AI, never written: skipped.
        { publication_id: 1, passage_key: 'refused#0' },
      ],
      deleted: [
        { publication_id: 5, passage_key: 'gone#0', language: 'en' },
        { publication_id: 5, passage_key: `${'y'.repeat(70)}#3`, language: 'en' },
      ],
    })
    assert.deepEqual(result, { upserted: 2, deleted: 2 })
    assert.deepEqual(calls.deleted, [
      ['en', ['5:gone#0', libraryVectorId(5, `${'y'.repeat(70)}#3`)]],
    ])
    assert.deepEqual(
      calls.upserted.map(([language, records]) => [language, records.length]),
      [
        ['fr', 1],
        ['en', 1],
      ]
    )
  })
})
