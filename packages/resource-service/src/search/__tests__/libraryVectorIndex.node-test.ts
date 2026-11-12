import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { describe, it } from 'node:test'

import {
  libraryVectorId,
  libraryVectorKey,
  libraryVectorRecord,
  libraryVectorizeFilter,
  makeVectorizeLibrarySearch,
  parseLibraryVectorKey,
  type LibraryVectorizeClient,
} from '../libraryVectorIndex'

describe('library vectors in Vectorize', () => {
  it('names a passage by its key, or by the start and a hash of a long one', () => {
    assert.equal(libraryVectorId(12, 'barnes/1/1/1#0'), '12:barnes/1/1/1#0')
    assert.deepEqual(parseLibraryVectorKey('barnes/1/1/1#0'), { passageKey: 'barnes/1/1/1#0' })
    const key = 'v10/reform-judaism-from-the-point-of-view-of-the-reform-jew/1#0'
    const id = libraryVectorId(369, key)
    assert.equal(new TextEncoder().encode(id).length, 64)
    const hash = createHash('sha256').update(key).digest('base64url').slice(0, 11)
    assert.equal(id, `369:${key.slice(0, 48)}~${hash}`)
    assert.deepEqual(parseLibraryVectorKey(libraryVectorKey(369, key)), {
      start: key.slice(0, 48),
      hash,
    })
    // Two parts of one long document share their start, not their hash.
    assert.notEqual(libraryVectorId(369, key.replace('#0', '#1')), id)
    // A multibyte character is never cut, and a key holding `~` is always hashed.
    const accented = libraryVectorKey(367, `${'é'.repeat(40)}#0`)
    assert.match(accented, /^é{24}~[A-Za-z0-9_-]{11}$/u)
    assert.match(libraryVectorKey(1, 'a~b#0'), /^a~[A-Za-z0-9_-]{11}$/u)
    const record = libraryVectorRecord({
      publication_id: 365,
      passage_key: 'the-millenium#0',
      language: 'en',
      work: 'bri',
      corpus: 'document',
      perspective: 'adventist',
      book: null,
      chapter: null,
      labelled: false,
    })
    assert.equal(record.id, '365:the-millenium#0')
    assert.ok(record.metadata.bucket === 0 || record.metadata.bucket === 1)
    assert.equal('book' in record.metadata, false)
  })

  it('translates the scope of a list into metadata conditions', () => {
    assert.deepEqual(libraryVectorizeFilter({}), {})
    assert.deepEqual(libraryVectorizeFilter({ excludeWorks: ['egw-writings'] }), {
      work: { $nin: ['egw-writings'] },
    })
    // A work both named and excluded is kept out; an empty list matches nothing.
    assert.deepEqual(
      libraryVectorizeFilter({ works: ['sdabc', 'bri'], excludeWorks: ['bri'], labelledOnly: true }),
      { work: { $in: ['sdabc'] }, labelled: { $eq: true } }
    )
    assert.equal(libraryVectorizeFilter({ works: ['bri'], excludeWorks: ['bri'] }), null)
    assert.equal(libraryVectorizeFilter({ works: [] }), null)
    // A chapter counts only with its book, as in SQL.
    assert.deepEqual(libraryVectorizeFilter({ corpora: ['commentary'], book: 66, chapter: 20 }), {
      corpus: { $in: ['commentary'] },
      book: { $eq: 66 },
      chapter: { $eq: 20 },
    })
    assert.deepEqual(libraryVectorizeFilter({ chapter: 20 }), {})
  })

  it('searches each language in its index, scored on the stored vectors first', async () => {
    const queries: [string, number, unknown, boolean][] = []
    const client = (language: string): LibraryVectorizeClient => ({
      async query(_vector, options) {
        queries.push([language, options.topK, options.filter, options.returnValues ?? false])
        const bucket = (options.filter?.bucket?.$eq as number | undefined) ?? 0
        // The compressed scores find farther passages too, scored lower.
        const offset = options.returnValues ? 0 : 0.05
        return {
          matches: Array.from({ length: options.topK }, (_, index) => ({
            id: `${bucket + 1}:key~${index}`,
            score: 0.9 - offset - index / 1000 - bucket / 10_000,
          })),
        }
      },
    })
    const clients = { fr: client('fr'), en: client('en') }
    const [deep, short, none] = await makeVectorizeLibrarySearch(clients).nearest(
      [0.1, 0.2],
      [
        { language: 'fr', limit: 150, filter: { excludeWorks: ['egw-writings'] } },
        { language: 'en', limit: 12, filter: { works: ['sdabc'] } },
        { language: 'en', limit: 12, filter: { works: [] } },
      ]
    )
    const nin = { work: { $nin: ['egw-writings'] } }
    assert.deepEqual(queries, [
      ['fr', 50, { ...nin, bucket: { $eq: 0 } }, true],
      ['fr', 50, { ...nin, bucket: { $eq: 1 } }, true],
      ['fr', 100, { ...nin, bucket: { $eq: 0 } }, false],
      ['fr', 100, { ...nin, bucket: { $eq: 1 } }, false],
      ['en', 12, { work: { $in: ['sdabc'] } }, true],
    ])
    // The 100 precise matches by score, both halves interleaved, then the others.
    assert.equal(deep!.length, 150)
    assert.deepEqual(deep!.slice(0, 2), [
      { publication_id: 1, key: 'key~0', distance: 1 - 0.9 },
      { publication_id: 2, key: 'key~0', distance: 1 - (0.9 - 1 / 10_000) },
    ])
    assert.deepEqual(deep![100], { publication_id: 1, key: 'key~50', distance: 1 - (0.85 - 0.05) })
    assert.equal(new Set(deep!.map(match => `${match.publication_id}:${match.key}`)).size, 150)
    assert.equal(short!.length, 12)
    assert.deepEqual(none, [])

    queries.length = 0
    await makeVectorizeLibrarySearch(clients, { precise: false }).nearest(
      [0.1, 0.2],
      [{ language: 'fr', limit: 150, filter: {} }]
    )
    assert.deepEqual(queries, [
      ['fr', 100, { bucket: { $eq: 0 } }, false],
      ['fr', 100, { bucket: { $eq: 1 } }, false],
    ])
  })
})
