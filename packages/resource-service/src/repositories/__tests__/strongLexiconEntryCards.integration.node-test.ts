import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { Cause, Effect, Exit, Option } from 'effect'
import type { Kysely } from 'kysely'

import { createIsolatedPostgres } from '../../database/__tests__/isolatedPostgresTestSupport'
import type { ResourceDatabase } from '../../database/types'
import { makeKyselyStrongLexiconRepository } from '../strongLexiconRepository'

const runIntegration = process.env.RESOURCE_INTEGRATION === '1'
const connectionString =
  process.env.RESOURCE_DATABASE_URL ??
  'postgresql://bible_strong:bible_strong@127.0.0.1:54329/bible_strong'

type Row = Record<string, string | number | null>
type Database = Kysely<ResourceDatabase>
type ModuleId = 'core' | 'simple-fr' | 'simple-en'
type Repository = ReturnType<typeof makeKyselyStrongLexiconRepository>
type CardsInput = Parameters<NonNullable<Repository['findEntryCards']>>[0]
type EntryInput = Parameters<Repository['findEntry']>[0]
type Kind = CardsInput['identities'][number]['kind']

const entry = (
  id: number,
  stepCode: string | undefined,
  fields: {
    eStrong: string
    dStrong?: string
    uStrong?: string
    baseCode?: number
    gloss: string
    morph?: string
    meaning?: string
    nameMeaningEnHtml?: string
    nameMeaningFrHtml?: string
  }
) => ({
  stepCode,
  payload: {
    id,
    language: fields.eStrong.startsWith('G') ? 'greek' : 'hebrew',
    baseCode: fields.baseCode ?? Number(fields.eStrong.replace(/\D/gu, '')),
    eStrong: fields.eStrong,
    dStrong: fields.dStrong ?? `${stepCode ?? fields.eStrong} =`,
    uStrong: fields.uStrong ?? stepCode ?? fields.eStrong,
    original: `original-${id}`,
    transliteration: `transliteration-${id}`,
    classicTransliteration: id % 2 ? `classic-${id}` : '',
    pronunciation: id % 3 ? `pronunciation-${id}` : '',
    gloss: fields.gloss,
    meaning: fields.meaning ?? `<p>meaning of ${fields.gloss}</p>`,
    morph: fields.morph ?? '',
    ...(fields.nameMeaningEnHtml ? { nameMeaningEnHtml: fields.nameMeaningEnHtml } : {}),
    ...(fields.nameMeaningFrHtml ? { nameMeaningFrHtml: fields.nameMeaningFrHtml } : {}),
  } satisfies Row,
})

const ENTRIES = [
  entry(1, 'H0085', {
    eStrong: 'H0085',
    gloss: 'Abraham',
    morph: 'N:N-M-P',
    nameMeaningEnHtml: '"father of a multitude"',
    nameMeaningFrHtml: '« père d’une multitude »',
  }),
  // Two senses of the classical number H430, the first one filed under the divine name.
  entry(2, 'H0430G', {
    eStrong: 'H0430',
    dStrong: 'H0430G = a Name of',
    uStrong: 'H3068G',
    gloss: 'God',
    morph: 'H:N-M',
  }),
  entry(3, 'H0430H', { eStrong: 'H0430', gloss: 'gods', morph: 'H:N-M' }),
  entry(4, 'H3068G', { eStrong: 'H3068', gloss: 'LORD', morph: 'N:N--T' }),
  // Senses numbered with a small letter, their identity with a capital.
  entry(5, 'H8138A', { eStrong: 'H8138a', gloss: 'to change', morph: 'h:v' }),
  entry(6, 'H8138B', { eStrong: 'H8138b', gloss: 'to repeat' }),
  entry(7, 'G2455G', { eStrong: 'G2455', gloss: 'Judas', morph: 'N:N-M-P' }),
  entry(8, 'G2455H', { eStrong: 'G2455', gloss: 'Judah', morph: 'N:N-M-P' }),
  entry(9, 'G3056', { eStrong: 'G3056', gloss: 'word', morph: 'G:N-M', meaning: '' }),
  // Two identities that differ only by the case of their letters.
  entry(10, 'H2148V', { eStrong: 'H2148', gloss: 'Zechariah the prophet' }),
  entry(11, 'H2148v', { eStrong: 'H2148', gloss: 'Zechariah son of Jehoiada' }),
  // Entries that carry a code no identity is written like.
  entry(12, 'H9000A', { eStrong: 'H9000', uStrong: 'H9001G', gloss: 'filed elsewhere' }),
  entry(13, 'H9002A', { eStrong: 'H9002x', dStrong: 'H9002', gloss: 'bare sense' }),
  // An entry without identity gives no card.
  entry(14, undefined, { eStrong: 'H9003', gloss: 'without identity' }),
  // Two entries carrying the code another one is named by, in another case.
  entry(15, 'H9100X', { eStrong: 'H9100a', gloss: 'shares a code' }),
  entry(16, 'H9100A', { eStrong: 'H9100a', gloss: 'named in capitals' }),
  // A classical number whose entries are told apart by language only.
  entry(17, 'G0085', { eStrong: 'G0085', gloss: 'to be distressed', morph: 'G:V' }),
  // A number its code does not show.
  entry(18, 'H9200A', { eStrong: 'H9200', baseCode: 7777, gloss: 'renumbered' }),
]

const TRANSLATIONS: Row[] = [
  { stepEntryId: 1, language: 'fr', gloss: 'Abraham', meaning: 'sens', meaningHtml: '<p>sens</p>' },
  { stepEntryId: 2, language: 'fr', gloss: 'Dieu', meaning: 'Dieu, divinité', meaningHtml: '' },
  { stepEntryId: 4, language: 'fr', gloss: 'Éternel', meaning: '', meaningHtml: '' },
  { stepEntryId: 5, language: 'fr', gloss: 'changer', meaning: '', meaningHtml: '' },
  { stepEntryId: 9, language: 'fr', gloss: 'parole', meaning: '', meaningHtml: '<p>parole</p>' },
  { stepEntryId: 9, language: 'en', gloss: 'ignored', meaning: 'ignored', meaningHtml: '' },
  { stepEntryId: 16, language: 'fr', gloss: 'nommé', meaning: '', meaningHtml: '' },
]

const MORPHOLOGY_CODES: Row[] = [
  {
    id: 1,
    code: 'N:N-M-P',
    normalizedCode: 'N:N-M-P',
    scope: 'tagged_full',
    meaning: 'Tagged form',
  },
  {
    id: 2,
    code: 'n:n-m-p',
    normalizedCode: 'N:N-M-P',
    scope: 'lexical_brief',
    meaning: 'Proper Name Masculine Person',
  },
  // The first of two rows naming one code, by identifier, describes it.
  { id: 3, code: 'N:N-M-P', normalizedCode: 'N:N-M-P', scope: 'lexical_brief', meaning: 'Later' },
  {
    id: 4,
    code: 'H:N-M',
    normalizedCode: 'H:N-M',
    scope: 'lexical_brief',
    meaning: 'Hebrew Noun Masculine',
  },
  {
    id: 5,
    code: 'G:N-M',
    normalizedCode: 'G:N-M',
    scope: 'lexical_brief',
    meaning: 'Greek Noun Masculine',
  },
  // Named by its code only: the normalised one differs.
  { id: 6, code: 'h:v', normalizedCode: 'H:V', scope: 'lexical_brief', meaning: 'Hebrew Verb' },
]

const MORPHOLOGY_TRANSLATIONS: Row[] = [
  { morphologyCodeId: 2, language: 'fr', meaning: 'Nom propre masculin de personne' },
  { morphologyCodeId: 3, language: 'fr', meaning: 'Doublon' },
  { morphologyCodeId: 5, language: 'fr', meaning: 'Nom grec masculin' },
  { morphologyCodeId: 5, language: 'en', meaning: 'ignored' },
]

const insertLexicon = async (
  database: Database,
  moduleId: ModuleId,
  options: { status?: 'active' | 'staged'; revision?: string } = {}
) => {
  const publication = await database
    .insertInto('resource_publications')
    .values({
      resource_identity: `strong-lexicon:${moduleId}`,
      resource_kind: 'strong-lexicon',
      revision: options.revision ?? `${moduleId}-r1`,
      language: 'mul',
      status: options.status ?? 'active',
      canonical_sha256: '1'.repeat(64),
      offline_artifact_sha256: '2'.repeat(64),
      provenance: { source: 'integration-test', imported_at: new Date(0).toISOString() },
      rights: { holder: 'integration-test', online: true, offline: true },
      metadata: {},
    })
    .returning('id')
    .executeTakeFirstOrThrow()
  const publicationId = publication.id
  // Each module has its own words, so that a card shows which one it was read from.
  const label = `${moduleId} ${options.revision ?? ''}`.trim()
  await database
    .insertInto('strong_lexicon_entries')
    .values(
      ENTRIES.map(({ payload }) => ({
        publication_id: publicationId,
        entry_id: payload.id,
        language: payload.language,
        e_strong: payload.eStrong,
        d_strong: payload.dStrong,
        u_strong: payload.uStrong,
        payload: { ...payload, gloss: `${payload.gloss} (${label})` },
      }))
    )
    .execute()
  await database
    .insertInto('strong_lexicon_entry_identities')
    .values(
      ENTRIES.flatMap(({ stepCode, payload }) =>
        stepCode
          ? [{ publication_id: publicationId, step_entry_id: payload.id, step_code: stepCode }]
          : []
      )
    )
    .execute()
  await database
    .insertInto('strong_lexicon_translations')
    .values(
      TRANSLATIONS.map(payload => ({
        publication_id: publicationId,
        step_entry_id: Number(payload.stepEntryId),
        language: String(payload.language),
        payload: { ...payload, gloss: `${payload.gloss} (${label})` },
      }))
    )
    .execute()
  await database
    .insertInto('strong_lexicon_morphology_codes')
    .values(
      MORPHOLOGY_CODES.map(payload => ({
        publication_id: publicationId,
        morphology_code_id: Number(payload.id),
        code: String(payload.code),
        normalized_code: String(payload.normalizedCode),
        language: 'hebrew',
        scope: String(payload.scope),
        payload,
      }))
    )
    .execute()
  await database
    .insertInto('strong_lexicon_morphology_code_translations')
    .values(
      MORPHOLOGY_TRANSLATIONS.map(payload => ({
        publication_id: publicationId,
        morphology_code_id: Number(payload.morphologyCodeId),
        language: String(payload.language),
        payload,
      }))
    )
    .execute()
  return publicationId
}

const KINDS: Kind[] = ['strong', 'estrong', 'dstrong', 'ustrong']

// Every way a reference reaches an entry, or none.
const REFERENCES = [
  'H0085',
  'H85',
  'h85',
  ' H0085 ',
  '85',
  'H0430',
  'H430',
  'H0430G',
  'H0430H',
  'h0430g',
  'H0430g',
  'H3068G',
  'H3068',
  'H8138',
  'H8138A',
  'H8138a',
  'H8138b',
  'G2455',
  'G2455G',
  'G2455H',
  'g2455',
  '2455',
  'G3056',
  'H2148',
  'H2148V',
  'H2148v',
  'H9000',
  'H9000A',
  'H9001G',
  'H9001g',
  'H9002',
  'H9002A',
  'H9002x',
  'H9003',
  'H9100',
  'H9100a',
  'H9100A',
  'H9100X',
  'H9200',
  'H7777',
  'G7777',
  'H9999',
  'H9999A',
  'H',
  'G',
  'H0',
  'not a code',
  'H0085 =',
  "H00'85",
]

const SINGLE_INPUTS: CardsInput[] = REFERENCES.flatMap(reference =>
  KINDS.flatMap(kind =>
    (
      [
        { language: 'fr', level: 'simple' },
        { language: 'en', level: 'simple' },
        { language: 'fr' },
        { language: 'en', level: 'detailed' },
      ] as const
    ).map(target => ({ identities: [{ reference, kind }], ...target }))
  )
)

const identities = (...values: string[]): CardsInput['identities'] =>
  values.map(value => {
    const [kind, ...reference] = value.split(':')
    return { kind: kind as Kind, reference: reference.join(':') }
  })

const SENSE_SUFFIXES = ['', ...'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz']

// Batches: the cards of one request depend on each other, since a reference without an
// identity is answered by the first entry that carries it among those of the whole batch.
const BATCHES: CardsInput['identities'][] = [
  // What the public page of a number asks for: every code a sense of it can carry.
  ...['H0430', 'H2148', 'H8138', 'G2455', 'H0085', 'H9100', 'H9999'].map(number =>
    SENSE_SUFFIXES.map(suffix => ({ kind: 'dstrong' as const, reference: `${number}${suffix}` }))
  ),
  identities('dstrong:H0430H', 'strong:H0430'),
  identities('strong:H0430', 'dstrong:H0430H'),
  identities('strong:H0430', 'dstrong:H0430H', 'dstrong:H0430G', 'estrong:H0430'),
  identities('dstrong:H9100a', 'strong:H9100', 'estrong:H9100a', 'dstrong:H9100X'),
  identities('strong:H9100', 'dstrong:H9100a'),
  identities('estrong:H9100a', 'dstrong:H9100a'),
  identities('dstrong:H2148V', 'dstrong:H2148v', 'dstrong:h2148V', 'strong:H2148'),
  identities('dstrong:H8138a', 'dstrong:H8138A', 'dstrong:H8138b', 'strong:H8138'),
  identities('dstrong:H8138a', 'dstrong:H8138a', 'estrong:H8138a'),
  identities('strong:H0085', 'strong:G0085', 'strong:85', 'dstrong:H0085', 'ustrong:H0085'),
  identities('ustrong:H3068G', 'ustrong:H9001G', 'estrong:H9001G', 'dstrong:H9002'),
  identities('estrong:H9003', 'strong:H9003', 'strong:H9200', 'strong:H7777', 'strong:G7777'),
  identities('strong:H9999', 'dstrong:H9999A', 'strong:not a code', 'strong:H'),
  identities(...ENTRIES.flatMap(({ stepCode }) => (stepCode ? [`dstrong:${stepCode}`] : []))),
  identities(...ENTRIES.map(({ payload }) => `strong:${payload.eStrong}`)),
  identities(...ENTRIES.map(({ payload }) => `estrong:${payload.eStrong}`)),
  identities(...ENTRIES.map(({ payload }) => `ustrong:${payload.uStrong}`)),
  identities(...ENTRIES.map(({ payload }) => `dstrong:${payload.dStrong}`)),
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
  const oneStatement = makeKyselyStrongLexiconRepository(counted)
  const statementByStatement = makeKyselyStrongLexiconRepository(database, {
    entryCardsRead: 'statement-by-statement',
  })
  // Reads both ways and returns the outcome once they agree, on the wire form too: key
  // order and absent keys are part of the response.
  const agreed = async <Value>(
    read: (repository: Repository) => Promise<Outcome<Value>>,
    label: string
  ) => {
    statements = 0
    const actual = await read(oneStatement)
    const counted = statements
    const expected = await read(statementByStatement)
    assert.deepEqual(actual, expected, label)
    assert.equal(JSON.stringify(actual), JSON.stringify(expected), label)
    return { ...actual, statements: counted }
  }
  return {
    cards: (input: CardsInput) =>
      agreed(
        repository => outcomeOf(repository.findEntryCards!(input)),
        `cards ${JSON.stringify(input)}`
      ),
    entry: (input: EntryInput) =>
      agreed(
        repository => outcomeOf(repository.findEntry(input)),
        `entry ${JSON.stringify(input)}`
      ),
  }
}

describe('Strong lexicon entry cards', { skip: !runIntegration }, () => {
  it('reads cards and a simple entry in one statement, equal to the earlier read', async () => {
    const isolated = await createIsolatedPostgres(connectionString, 'strong_cards', 1)
    const { database } = isolated

    try {
      await insertLexicon(database, 'core')
      await insertLexicon(database, 'simple-fr')
      // A staged revision is not read.
      await insertLexicon(database, 'simple-fr', { status: 'staged', revision: 'simple-fr-r2' })
      const { cards, entry } = readers(database)

      // English simple entries are not published yet.
      const unpublished = await cards({
        identities: identities('strong:H0085'),
        language: 'en',
        level: 'simple',
      })
      assert.equal(unpublished.failure, 'ActiveStrongLexiconPublicationUnavailable')
      assert.equal(unpublished.statements, 1)
      await insertLexicon(database, 'simple-en')

      let found = 0
      for (const input of SINGLE_INPUTS) {
        const outcome = await cards(input)
        assert.equal(outcome.statements, 1, JSON.stringify(input))
        assert.ok(outcome.value, JSON.stringify(input))
        found += outcome.value.length
        // A simple entry is the card of its reference.
        const [identity] = input.identities
        if (input.level !== 'simple') continue
        const read = await entry({
          reference: identity!.reference,
          kind: identity!.kind,
          language: input.language,
          level: 'simple',
        })
        assert.equal(read.statements, 1, JSON.stringify(input))
        assert.equal(read.failure, outcome.value.length ? undefined : 'StrongLexiconEntryNotFound')
        if (identity!.kind === 'strong') {
          const { statements: _, ...withoutKind } = await entry({
            reference: identity!.reference,
            language: input.language,
            level: 'simple',
          })
          const { statements: __, ...withKind } = read
          assert.deepEqual(withoutKind, withKind, JSON.stringify(input))
        }
      }
      assert.ok(found > SINGLE_INPUTS.length / 3)

      for (const batch of BATCHES) {
        for (const target of [
          { language: 'fr', level: 'simple' },
          { language: 'en', level: 'simple' },
          { language: 'fr' },
        ] as const) {
          const outcome = await cards({ identities: batch, ...target })
          assert.equal(outcome.statements, 1)
          assert.ok(outcome.value)
        }
      }

      // No identity, no read.
      const none = await cards({ identities: [], language: 'fr', level: 'simple' })
      assert.deepEqual(none.value, [])
      assert.equal(none.statements, 0)

      const valuesOf = async (input: CardsInput) => {
        const outcome = await cards(input)
        assert.ok(outcome.value)
        return outcome.value.map(card => card.value)
      }

      // A card is read from the lexicon of its level and language.
      const levels = await Promise.all(
        (
          [
            { language: 'fr', level: 'simple' },
            { language: 'en', level: 'simple' },
            { language: 'fr' },
          ] as const
        ).map(target => valuesOf({ identities: identities('dstrong:G3056'), ...target }))
      )
      assert.deepEqual(
        levels.map(([card]) => card?.gloss),
        ['parole (simple-fr)', 'word (simple-en)', 'parole (core)']
      )
      const [simple] = await cards({
        identities: identities('dstrong:G3056'),
        language: 'fr',
        level: 'simple',
      }).then(outcome => outcome.value ?? [])
      assert.equal(simple?.revision, 'core:simple-fr-r1')
      assert.deepEqual(simple?.value.morphology, { code: 'G:N-M', meaning: 'Nom grec masculin' })
      assert.equal(simple?.value.definitionHtml, '<p>parole</p>')

      // The senses of a number: the codes that name an entry, in the order asked.
      const senses = await valuesOf({
        identities: SENSE_SUFFIXES.map(suffix => ({
          kind: 'dstrong',
          reference: `H0430${suffix}`,
        })),
        language: 'fr',
        level: 'simple',
      })
      assert.deepEqual(
        senses.map(card => [card.selectedIdentity.code, card.stepCode]),
        [
          // The number itself is answered by its first sense.
          ['H0430', 'H0430G'],
          ['H0430G', 'H0430G'],
          ['H0430H', 'H0430H'],
          // A small letter names the sense written with a capital when there is only one.
          ['H0430g', 'H0430G'],
          ['H0430h', 'H0430H'],
        ]
      )
      // Two identities that differ by case are each their own sense.
      const cased = await valuesOf({
        identities: identities('dstrong:H2148V', 'dstrong:H2148v'),
        language: 'en',
        level: 'simple',
      })
      assert.deepEqual(
        cased.map(card => [card.stepCode, card.gloss]),
        [
          ['H2148V', 'Zechariah the prophet (simple-en)'],
          ['H2148v', 'Zechariah son of Jehoiada (simple-en)'],
        ]
      )
      // The first row, by identifier, that names the code of an entry describes it.
      const [abraham] = await valuesOf({
        identities: identities('strong:H85'),
        language: 'fr',
        level: 'simple',
      })
      assert.deepEqual(abraham?.morphology, {
        code: 'N:N-M-P',
        meaning: 'Nom propre masculin de personne',
      })
      assert.equal(abraham?.nameMeaningHtml, '« père d’une multitude »')

      // Without the lexicon of a level, its cards and entries are unavailable.
      await database
        .updateTable('resource_publications')
        .set({ status: 'staged' })
        .where('resource_identity', '=', 'strong-lexicon:core')
        .execute()
      const withoutCore = await cards({ identities: identities('strong:H0085'), language: 'fr' })
      assert.equal(withoutCore.failure, 'ActiveStrongLexiconPublicationUnavailable')
      const simpleWithoutCore = await entry({ reference: 'H0085', language: 'fr', level: 'simple' })
      assert.ok(simpleWithoutCore.value)
    } finally {
      await isolated.dispose()
    }
  })
})
