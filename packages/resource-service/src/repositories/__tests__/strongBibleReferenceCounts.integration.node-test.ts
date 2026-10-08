import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { Cause, Effect, Exit, Option } from 'effect'
import type { Kysely } from 'kysely'

import { createIsolatedPostgres } from '../../database/__tests__/isolatedPostgresTestSupport'
import type { ResourceDatabase } from '../../database/types'
import { makeKyselyStrongBibleRepository } from '../strongBibleRepository'

const runIntegration = process.env.RESOURCE_INTEGRATION === '1'
const connectionString =
  process.env.RESOURCE_DATABASE_URL ??
  'postgresql://bible_strong:bible_strong@127.0.0.1:54329/bible_strong'

type Database = Kysely<ResourceDatabase>

const TEXT_SHA256 = '1'.repeat(64)

const insertPublication = async (
  database: Database,
  identity: string,
  revision: string,
  metadata: Record<string, unknown>,
  status: 'active' | 'staged' = 'active'
) =>
  (
    await database
      .insertInto('resource_publications')
      .values({
        resource_identity: identity,
        resource_kind: identity.split(':')[0]!,
        revision,
        language: 'fr',
        status,
        canonical_sha256: '4'.repeat(64),
        offline_artifact_sha256: '5'.repeat(64),
        provenance: { source: 'integration-test', imported_at: new Date(0).toISOString() },
        rights: { holder: 'integration-test', online: true, offline: true },
        metadata,
      })
      .returning('id')
      .executeTakeFirstOrThrow()
  ).id

// The identities of an index, and the verses each one is read in, as `book.chapter.verse`.
const IDENTITIES: { kind: string; code: string; verses: string[] }[] = [
  { kind: 'strong', code: 'H0430', verses: ['1.1.1', '1.1.2', '1.2.4', '2.3.6', '19.8.5'] },
  // A word read twice in one verse counts the verse once.
  { kind: 'dstrong', code: 'H0430G', verses: ['1.1.1', '1.1.1', '1.1.2', '2.3.6'] },
  { kind: 'dstrong', code: 'H0430H', verses: ['19.8.5'] },
  // Two men told apart by the case of a letter.
  { kind: 'dstrong', code: 'H2148V', verses: ['38.1.1', '38.7.1', '15.5.1'] },
  { kind: 'dstrong', code: 'H2148v', verses: ['14.24.20'] },
  // A sense the index names by its extended code only.
  { kind: 'estrong', code: 'H2148a', verses: ['13.9.21'] },
  { kind: 'estrong', code: 'H8138A', verses: ['18.14.20'] },
  // An identity written without its zeros, and one no verse is tagged with.
  { kind: 'strong', code: 'H85', verses: ['1.17.5'] },
  { kind: 'dstrong', code: 'H0085A', verses: [] },
  { kind: 'strong', code: 'G2316', verses: ['40.1.23', '43.1.1'] },
  { kind: 'ustrong', code: 'H3068G', verses: ['1.2.4'] },
]

const insertIndex = async (
  database: Database,
  versionId: string,
  revision: string,
  options: { status?: 'active' | 'staged'; textRevision?: string; shift?: number } = {}
) => {
  const publicationId = await insertPublication(
    database,
    `strong-bible-index:${versionId}`,
    revision,
    {
      dataset_id: versionId,
      text_revision: options.textRevision ?? 'text-r1',
      text_sha256: TEXT_SHA256,
      strong_revision: 'strong-r1',
    },
    options.status
  )
  // Another index numbers its identities otherwise.
  const identityId = (position: number) => position + 1 + (options.shift ?? 0)
  const located = IDENTITIES.flatMap((identity, position) =>
    identity.verses.map(verse => {
      const [book, chapter, number] = verse.split('.').map(Number)
      return { identityId: identityId(position), book: book!, chapter: chapter!, verse: number! }
    })
  )
  const verses = [...new Set(located.map(row => `${row.book}.${row.chapter}.${row.verse}`))]
  await database
    .insertInto('strong_bible_verses')
    .values(
      verses.map(verse => {
        const [book, chapter, number] = verse.split('.').map(Number)
        return { publication_id: publicationId, book: book!, chapter: chapter!, verse: number! }
      })
    )
    .execute()
  await database
    .insertInto('strong_bible_identities')
    .values(
      IDENTITIES.map((identity, position) => ({
        publication_id: publicationId,
        identity_id: identityId(position),
        kind: identity.kind,
        code: identity.code,
      }))
    )
    .execute()
  // One span per tagged word, in the order they are listed.
  const ordinals = new Map<string, number>()
  const spans = located.map(row => {
    const key = `${row.book}.${row.chapter}.${row.verse}`
    const ordinal = ordinals.get(key) ?? 0
    ordinals.set(key, ordinal + 1)
    return { ...row, ordinal }
  })
  await database
    .insertInto('strong_bible_spans')
    .values(
      spans.map(span => ({
        publication_id: publicationId,
        book: span.book,
        chapter: span.chapter,
        verse: span.verse,
        ordinal: span.ordinal,
        start_offset: span.ordinal * 5,
        length: 4,
        is_aligned: true,
      }))
    )
    .execute()
  await database
    .insertInto('strong_bible_span_identities')
    .values(
      spans.map(span => ({
        publication_id: publicationId,
        book: span.book,
        chapter: span.chapter,
        verse: span.verse,
        ordinal: span.ordinal,
        identity_order: 0,
        identity_id: span.identityId,
      }))
    )
    .execute()
  return publicationId
}

// Every way a reference reaches an identity, or none.
const REFERENCES = [
  'H0430',
  'H430',
  'h430',
  '430',
  '0430',
  'H0430G',
  'H0430g',
  'h0430g',
  'H0430H',
  'H0430Z',
  'H2148V',
  'H2148v',
  'H2148A',
  'H2148a',
  'H2148',
  'H8138A',
  'H8138a',
  'H0085',
  'H85',
  '85',
  'H0085A',
  'G2316',
  '2316',
  'H3068G',
  'H3068',
  'H9999',
]
const SENSE_SUFFIXES = [...'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz']

const BATCHES: { book: number; references: string[] }[] = [
  ...REFERENCES.map(reference => ({ book: 1, references: [reference] })),
  { book: 1, references: REFERENCES },
  // The book chooses the letter of a reference written without one.
  { book: 40, references: REFERENCES },
  { book: 39, references: ['430', '2316'] },
  // What a page of a number asks for: every code a sense of it can carry.
  ...['H0430', 'H2148', 'H8138', 'H0085', 'H9999'].map(number => ({
    book: 1,
    references: SENSE_SUFFIXES.map(suffix => `${number}${suffix}`),
  })),
  // A reference asked twice is answered once, where it was first asked.
  { book: 1, references: ['H0430H', 'H0430', 'H0430H', 'H0430G', 'H0430'] },
  { book: 1, references: [] },
]

type Outcome<Value> = { value?: Value; failure?: string }

const outcomeOf = async <Value>(
  effect: Effect.Effect<Value, { _tag: string }>
): Promise<Outcome<Value>> =>
  Exit.match(await Effect.runPromiseExit(effect), {
    onSuccess: (value): Outcome<Value> => ({ value }),
    onFailure: (cause): Outcome<Value> => ({
      failure: Option.match(Cause.failureOption(cause), {
        onNone: () => 'defect',
        onSome: error => error._tag,
      }),
    }),
  })

const readers = (database: Database) => {
  let statements = 0
  const counted = database.withPlugin({
    transformQuery(args) {
      statements += 1
      return args.node
    },
    async transformResult(args) {
      return args.result
    },
  })
  const oneStatement = makeKyselyStrongBibleRepository(counted)
  const readByRead = makeKyselyStrongBibleRepository(database, {
    referenceCountsRead: 'read-by-read',
  })
  const routes = makeKyselyStrongBibleRepository(database)

  // What the counts route of each reference answers.
  const fromRoutes = async (versionId: string, book: number, references: string[]) => {
    const answers = []
    for (const reference of [...new Set(references)]) {
      const { identity, counts } = await Effect.runPromise(
        routes.findCountsByBook({ versionId, book, reference })
      )
      answers.push({ reference, ...(identity ? { identity } : {}), counts })
    }
    return answers
  }

  // Reads both ways and returns the outcome once they agree, on the wire form too.
  const counts = async (versionId: string, book: number, references: string[]) => {
    const label = `${versionId} ${book} ${references.join(',')}`
    statements = 0
    const actual = await outcomeOf(
      oneStatement.findCountsByBookOfReferences({ versionId, book, references })
    )
    const counted = statements
    const expected = await outcomeOf(
      readByRead.findCountsByBookOfReferences({ versionId, book, references })
    )
    assert.deepEqual(actual, expected, label)
    assert.equal(JSON.stringify(actual), JSON.stringify(expected), label)
    assert.equal(counted, 1, label)
    return actual
  }
  return { counts, fromRoutes }
}

describe('Strong Bible counts of several references', { skip: !runIntegration }, () => {
  it('reads them in one statement, equal to the counts of each reference', async () => {
    const isolated = await createIsolatedPostgres(connectionString, 'strong_counts', 1)
    const { database } = isolated

    try {
      const { counts, fromRoutes } = readers(database)

      // No index, or no Bible text: nothing is read.
      assert.equal(
        (await counts('LSG', 1, ['H0430'])).failure,
        'ActiveStrongBiblePublicationUnavailable'
      )
      const index = await insertIndex(database, 'LSG', 'lsg-strong-r1')
      assert.equal(
        (await counts('LSG', 1, ['H0430'])).failure,
        'ActiveStrongBiblePublicationUnavailable'
      )
      const text = await insertPublication(database, 'bible-text:LSG', 'text-r1', {
        text_revision: 'text-r1',
        text_sha256: TEXT_SHA256,
      })
      // Another version, whose identities are numbered otherwise, is not read.
      await insertIndex(database, 'KJV', 'kjv-strong-r1', { shift: 3 })
      await insertPublication(database, 'bible-text:KJV', 'text-r1', {
        text_revision: 'text-r1',
        text_sha256: TEXT_SHA256,
      })
      // Nor is a staged revision of the same one.
      await insertIndex(database, 'LSG', 'lsg-strong-r2', { status: 'staged', shift: 5 })

      for (const versionId of ['LSG', 'KJV']) {
        for (const batch of BATCHES) {
          const outcome = await counts(versionId, batch.book, batch.references)
          assert.ok(outcome.value, JSON.stringify(batch))
          assert.deepEqual(
            outcome.value.references,
            await fromRoutes(versionId, batch.book, batch.references),
            JSON.stringify(batch)
          )
        }
      }

      const read = async (book: number, references: string[]) =>
        (await counts('LSG', book, references)).value!
      const told = async (book: number, references: string[]) =>
        (await read(book, references)).references.map(answer => [
          answer.reference,
          answer.identity?.kind,
          answer.identity?.code,
          answer.counts.map(count => `${count.book}:${count.verseCount}`).join(' '),
        ])

      assert.deepEqual(await read(1, ['H0430G', 'H0430Z']), {
        versionId: 'LSG',
        datasetId: 'LSG',
        revision: 'lsg-strong-r1',
        textRevision: 'text-r1',
        textSha256: TEXT_SHA256,
        strongRevision: 'strong-r1',
        references: [
          {
            reference: 'H0430G',
            identity: { id: 2, kind: 'dstrong', code: 'H0430G' },
            // The verses of each book, the books in the order of the Bible.
            counts: [
              { book: 1, verseCount: 2 },
              { book: 2, verseCount: 1 },
            ],
          },
          // A reference the index does not hold is answered, with nothing.
          { reference: 'H0430Z', counts: [] },
        ],
      })
      assert.deepEqual(
        await told(1, ['H2148V', 'H2148v', 'H2148a', 'H2148A', 'h430', '85', 'H0085A', 'H9999']),
        [
          // The case of a letter tells two senses apart…
          ['H2148V', 'dstrong', 'H2148V', '15:1 38:2'],
          ['H2148v', 'dstrong', 'H2148v', '14:1'],
          // …and a reference is read as it is written before its capitals are tried, under
          // the extended code when the index names the sense by that one.
          ['H2148a', 'estrong', 'H2148a', '13:1'],
          ['H2148A', undefined, undefined, ''],
          ['h430', 'strong', 'H0430', '1:3 2:1 19:1'],
          ['85', 'strong', 'H85', '1:1'],
          // An identity no verse is tagged with is named, with no count.
          ['H0085A', 'dstrong', 'H0085A', ''],
          ['H9999', undefined, undefined, ''],
        ]
      )
      assert.deepEqual(await told(40, ['2316', '430']), [
        ['2316', 'strong', 'G2316', '40:1 43:1'],
        ['430', undefined, undefined, ''],
      ])
      assert.deepEqual(
        (await read(1, ['H0430H', 'H0430', 'H0430H'])).references.map(answer => answer.reference),
        ['H0430H', 'H0430']
      )
      assert.deepEqual((await read(1, [])).references, [])

      // An index is read only with the Bible text it was aligned on.
      await database
        .updateTable('resource_publications')
        .set({ metadata: { text_revision: 'text-r2', text_sha256: TEXT_SHA256 } })
        .where('id', '=', text)
        .execute()
      assert.equal(
        (await counts('LSG', 1, ['H0430'])).failure,
        'ActiveStrongBiblePublicationUnavailable'
      )
      await database
        .updateTable('resource_publications')
        .set({ status: 'staged' })
        .where('id', '=', index)
        .execute()
      await insertIndex(database, 'LSG', 'lsg-strong-r3', { textRevision: 'text-r2', shift: 7 })
      const renewed = await read(1, ['H0430H'])
      assert.equal(renewed.revision, 'lsg-strong-r3')
      assert.deepEqual(renewed.references, [
        {
          reference: 'H0430H',
          identity: { id: 10, kind: 'dstrong', code: 'H0430H' },
          counts: [{ book: 19, verseCount: 1 }],
        },
      ])
    } finally {
      await isolated.dispose()
    }
  })
})
