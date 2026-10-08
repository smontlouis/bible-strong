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
type Language = 'fr' | 'en'
type LexiconModuleId = 'core' | 'simple-fr' | 'simple-en'
type Repository = ReturnType<typeof makeKyselyStrongLexiconRepository>

type Entry = { stepCode: string | undefined; payload: Row }

const entry = (
  id: number,
  stepCode: string | undefined,
  fields: {
    eStrong: string
    dStrong?: string
    uStrong?: string
    baseCode?: number
    gloss: string
    meaning?: string
  }
): Entry => ({
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
    gloss: fields.gloss,
    meaning: fields.meaning ?? `<p>notice of ${fields.gloss}</p>`,
    morph: '',
  },
})

// The entries of every lexicon. The detailed one differs where a comment says so.
const ENTRIES: Entry[] = [
  // A number with one sense, which carries the number as its code.
  entry(1, 'H0085', { eStrong: 'H0085', gloss: 'Abraham' }),
  // Two senses, the first filed under the divine name.
  entry(2, 'H0430G', { eStrong: 'H0430', uStrong: 'H3068G', gloss: 'God' }),
  entry(3, 'H0430H', { eStrong: 'H0430', gloss: 'gods', meaning: '' }),
  entry(4, 'H3068G', { eStrong: 'H3068', gloss: 'LORD' }),
  // Senses told apart by the case of their letter.
  entry(5, 'H2148A', { eStrong: 'H2148', gloss: 'Zechariah' }),
  entry(6, 'H2148V', { eStrong: 'H2148', gloss: 'Zechariah' }),
  entry(7, 'H2148v', { eStrong: 'H2148', gloss: 'Zechariah' }),
  // Senses of a Greek number, and the number itself among them.
  entry(8, 'G2455', { eStrong: 'G2455', gloss: 'Judas' }),
  entry(9, 'G2455G', { eStrong: 'G2455', gloss: 'Judas' }),
  entry(10, 'G2455H', { eStrong: 'G2455', gloss: 'Judah' }),
  // Senses numbered with a small letter, their identity with a capital.
  entry(11, 'H8138A', { eStrong: 'H8138a', gloss: 'to change' }),
  entry(12, 'H8138B', { eStrong: 'H8138b', gloss: 'to repeat' }),
  // A sense the detailed lexicon names otherwise, and one it does not hold.
  entry(13, 'H7000A', { eStrong: 'H7000', gloss: 'carried' }),
  entry(14, 'H7000B', { eStrong: 'H7000', gloss: 'absent' }),
  // A code written without its zero.
  entry(15, 'H701A', { eStrong: 'H0701', dStrong: 'H0701A =', gloss: 'loosely written' }),
  entry(16, 'H0701B', { eStrong: 'H0701', gloss: 'well written' }),
  // An entry of another number answering a code of this one.
  entry(17, 'H9001A', { eStrong: 'H9001', uStrong: 'H9000B', gloss: 'filed elsewhere' }),
  entry(18, 'H9000A', { eStrong: 'H9000', gloss: 'filed here' }),
  // An entry without identity is no sense.
  entry(19, undefined, { eStrong: 'H9000', dStrong: 'H9000C =', gloss: 'without identity' }),
]

const CORE_ENTRIES: Entry[] = ENTRIES.flatMap(candidate => {
  switch (candidate.payload.id) {
    // Named by another identity, and carrying the code of the sense.
    case 13:
      return [{ stepCode: 'H7000X', payload: { ...candidate.payload, dStrong: 'H7000A' } }]
    case 14:
      return []
    // Written with its zero.
    case 15:
      return [{ ...candidate, stepCode: 'H0701A' }]
    // Filed under another number than in the simple lexicons.
    case 12:
      return [{ ...candidate, payload: { ...candidate.payload, baseCode: 8139 } }]
    default:
      return [candidate]
  }
})

const TRANSLATIONS: Row[] = [
  { stepEntryId: 2, language: 'fr', gloss: 'Dieu', meaning: 'Dieu, divinité', meaningHtml: '' },
  { stepEntryId: 3, language: 'fr', gloss: 'dieux', meaning: '', meaningHtml: '' },
  { stepEntryId: 5, language: 'fr', gloss: 'Zacharie', meaning: '', meaningHtml: '<p>fils</p>' },
  { stepEntryId: 5, language: 'en', gloss: 'ignored', meaning: 'ignored', meaningHtml: '' },
  { stepEntryId: 8, language: 'fr', gloss: 'Judas', meaning: 'plain', meaningHtml: '<p>html</p>' },
]

const insertPublication = async (
  database: Database,
  moduleId: LexiconModuleId | 'entities',
  options: { revision?: string; status?: 'active' | 'staged'; coreRevision?: string } = {}
) =>
  (
    await database
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
        metadata:
          moduleId === 'entities'
            ? { dependencies: [{ revision: options.coreRevision ?? 'core-r1' }] }
            : {},
      })
      .returning('id')
      .executeTakeFirstOrThrow()
  ).id

const insertLexicon = async (
  database: Database,
  moduleId: LexiconModuleId,
  options: { revision?: string; status?: 'active' | 'staged' } = {}
) => {
  const publicationId = await insertPublication(database, moduleId, options)
  const entries = moduleId === 'core' ? CORE_ENTRIES : ENTRIES
  // Each lexicon has its own words, so that a sense shows which one each part was read from.
  const label = `${moduleId} ${options.revision ?? ''}`.trim()
  const labelled = (payload: Row): Row => ({
    ...payload,
    gloss: `${payload.gloss} (${label})`,
    ...(payload.meaning ? { meaning: `${payload.meaning} (${label})` } : {}),
    ...(payload.meaningHtml ? { meaningHtml: `${payload.meaningHtml} (${label})` } : {}),
  })
  await database
    .insertInto('strong_lexicon_entries')
    .values(
      entries.map(({ payload }) => ({
        publication_id: publicationId,
        entry_id: Number(payload.id),
        language: String(payload.language),
        e_strong: String(payload.eStrong),
        d_strong: String(payload.dStrong),
        u_strong: String(payload.uStrong),
        payload: labelled(payload),
      }))
    )
    .execute()
  await database
    .insertInto('strong_lexicon_entry_identities')
    .values(
      entries.flatMap(({ stepCode, payload }) =>
        stepCode
          ? [
              {
                publication_id: publicationId,
                step_entry_id: Number(payload.id),
                step_code: stepCode,
              },
            ]
          : []
      )
    )
    .execute()
  await database
    .insertInto('strong_lexicon_translations')
    .values(
      TRANSLATIONS.filter(payload =>
        entries.some(candidate => candidate.payload.id === payload.stepEntryId)
      ).map(payload => ({
        publication_id: publicationId,
        step_entry_id: Number(payload.stepEntryId),
        language: String(payload.language),
        payload: labelled(payload),
      }))
    )
    .execute()
  return publicationId
}

const entity = (id: number, uStrong: string, displayName: string, brief = `${displayName} brief`) =>
  ({ id, uniqueName: `entity-${id}`, uStrong, displayName, brief }) satisfies Row

const ENTITIES: Row[] = [
  entity(10, 'H3068G', 'LORD'),
  // Under the code of one sense, and under the extended code two senses share.
  entity(20, 'H2148V', 'Zechariah the prophet'),
  entity(21, 'H2148', 'Zechariah of the number'),
  // Under the classical number only: kept when named like the entry.
  entity(30, 'G2455K', 'Judas (core)', 'Judas the disciple'),
  entity(31, 'G2455L', 'Judah (core)', ''),
  entity(32, 'G24550', 'Judas (core)', 'another number'),
  entity(33, 'H8139Z', 'to repeat (core)', 'filed with the detailed number'),
  entity(34, 'H8138Z', 'to repeat (core)', 'filed with the simple number'),
  entity(35, 'H7000Q', 'carried (core)', 'of the carried sense'),
]

const ENTITY_TRANSLATIONS: Row[] = [
  { id: 1, entityId: 10, language: 'fr', brief: 'Éternel bref' },
  // Two translations of one entity: the first one, by stored key, is read.
  { id: 2, entityId: 20, language: 'fr', brief: 'le prophète' },
  { id: 3, entityId: 20, language: 'fr', brief: 'le second' },
  // An empty translation leaves the words of the entity.
  { id: 4, entityId: 30, language: 'fr', brief: '' },
  { id: 5, entityId: 21, language: 'en', brief: 'ignored' },
  { id: 6, entityId: 33, language: 'fr', brief: 'rangé avec le numéro détaillé' },
]

const insertEntities = async (
  database: Database,
  options: { revision?: string; status?: 'active' | 'staged'; coreRevision?: string } = {}
) => {
  const publicationId = await insertPublication(database, 'entities', options)
  await database
    .insertInto('strong_lexicon_entities')
    .values(
      ENTITIES.map(payload => ({
        publication_id: publicationId,
        entity_id: Number(payload.id),
        unique_name: String(payload.uniqueName),
        u_strong: String(payload.uStrong),
        payload,
      }))
    )
    .execute()
  await database
    .insertInto('strong_lexicon_entity_translations')
    .values(
      ENTITY_TRANSLATIONS.map(payload => ({
        publication_id: publicationId,
        translation_id: Number(payload.id),
        entity_id: Number(payload.entityId),
        language: String(payload.language),
        payload,
      }))
    )
    .execute()
  return publicationId
}

const setStatus = (database: Database, publicationId: number, status: 'active' | 'staged') =>
  database
    .updateTable('resource_publications')
    .set({ status })
    .where('id', '=', publicationId)
    .execute()

const NUMBERS = [
  'H0085',
  'H0430',
  'H3068',
  'H2148',
  'G2455',
  'H8138',
  'H8139',
  'H7000',
  'H0701',
  'H9000',
  'H9001',
  'H9999',
  // Written loosely.
  'h430',
  'H430',
  'g2455',
]
const LANGUAGES: Language[] = ['fr', 'en']
const SENSE_SUFFIXES = ['', ...'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz']

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
  const readByRead = makeKyselyStrongLexiconRepository(database, {
    numberSensesRead: 'read-by-read',
  })
  const routes: Repository = makeKyselyStrongLexiconRepository(database)

  // What the existing routes answer a page that asks for the senses of a number: the cards
  // of every code a sense can carry, then the detailed entry of each sense.
  const fromRoutes = async (number: string, language: Language) => {
    const classicStrong = `${number[0]!.toUpperCase()}${number.slice(1).padStart(4, '0')}`
    const cards = await Effect.runPromise(
      routes.findEntryCards!({
        language,
        level: 'simple',
        identities: SENSE_SUFFIXES.map(suffix => ({
          kind: 'dstrong',
          reference: `${classicStrong}${suffix}`,
        })),
      })
    )
    const seen = new Set<string>()
    const senses = []
    for (const { value: card } of cards) {
      const key = `${card.id} ${card.stepCode}`
      if (card.classicStrong !== classicStrong || seen.has(key)) continue
      seen.add(key)
      const detailed = await outcomeOf(routes.findEntry({ reference: card.stepCode, language }))
      assert.ok(detailed.value || detailed.failure === 'StrongLexiconEntryNotFound')
      const found = detailed.value?.value
      senses.push({
        id: card.id,
        stepCode: card.stepCode,
        classicStrong: card.classicStrong,
        language: card.language,
        original: card.original,
        transliteration: card.transliteration,
        gloss: card.gloss,
        ...(found?.definitionHtml === undefined
          ? {}
          : { detailedDefinitionHtml: found.definitionHtml }),
        ...(found?.entity === undefined ? {} : { entityBrief: found.entity.brief }),
      })
    }
    return { classicStrong, senses }
  }

  // Reads both ways and returns the outcome once they agree, on the wire form too: key
  // order and absent keys are part of the response.
  const senses = async (number: string, language: Language) => {
    const label = `${number} ${language}`
    statements = 0
    const actual = await outcomeOf(oneStatement.findNumberSenses({ number, language }))
    const counted = statements
    const expected = await outcomeOf(readByRead.findNumberSenses({ number, language }))
    assert.deepEqual(actual, expected, label)
    assert.equal(JSON.stringify(actual), JSON.stringify(expected), label)
    return { ...actual, statements: counted }
  }
  return { senses, fromRoutes }
}

describe('Strong lexicon senses of a number', { skip: !runIntegration }, () => {
  it('reads the senses of a number in one statement, equal to the reads of a page', async () => {
    const isolated = await createIsolatedPostgres(connectionString, 'strong_senses', 1)
    const { database } = isolated

    try {
      const { senses, fromRoutes } = readers(database)
      const simpleFr = await insertLexicon(database, 'simple-fr')
      // A staged revision is not read.
      await insertLexicon(database, 'simple-fr', { status: 'staged', revision: 'simple-fr-r2' })

      // The senses are read from the simple lexicon and from the detailed one.
      const withoutCore = await senses('H0430', 'fr')
      assert.equal(withoutCore.failure, 'ActiveStrongLexiconPublicationUnavailable')
      assert.equal(withoutCore.statements, 1)
      const core = await insertLexicon(database, 'core')
      const withoutEnglish = await senses('H0430', 'en')
      assert.equal(withoutEnglish.failure, 'ActiveStrongLexiconPublicationUnavailable')
      await insertLexicon(database, 'simple-en')

      const everyNumber = async () => {
        const read = new Map<string, Awaited<ReturnType<typeof senses>>>()
        for (const number of NUMBERS) {
          for (const language of LANGUAGES) {
            const outcome = await senses(number, language)
            assert.ok(outcome.value, `${number} ${language}`)
            assert.deepEqual(
              outcome.value.value,
              await fromRoutes(number, language),
              `${number} ${language}`
            )
            read.set(`${number} ${language}`, outcome)
          }
        }
        return read
      }

      // Without entities, a sense is told apart by its notice alone.
      const bare = await everyNumber()
      assert.ok(
        [...bare.values()].every(outcome =>
          outcome.value!.value.senses.every(sense => sense.entityBrief === undefined)
        )
      )
      assert.match(bare.get('H0430 fr')!.value!.revision, /\|entities:unavailable::$/u)

      const entities = await insertEntities(database)
      const read = await everyNumber()
      const sensesOf = (key: string) => read.get(key)!.value!.value.senses
      const told = (key: string) =>
        sensesOf(key).map(sense => [
          sense.stepCode,
          sense.gloss,
          sense.detailedDefinitionHtml,
          sense.entityBrief,
        ])

      // One statement, whatever the number holds…
      for (const [key, outcome] of read) {
        if (/^(?:H7000|H0701) /u.test(key)) continue
        assert.equal(outcome.statements, 1, key)
      }
      // …but for a sense whose code the detailed lexicon does not name as it is written:
      // its detailed entry is read as its own route reads it.
      assert.equal(read.get('H7000 fr')!.statements, 3)
      assert.equal(read.get('H0701 fr')!.statements, 2)

      assert.equal(
        read.get('H0430 fr')!.value!.revision,
        'strong-lexicon-number-senses-v1|simple:simple-fr-r1|core:core-r1|entities:available:entities-r1:core-r1'
      )
      assert.deepEqual(told('H0430 fr'), [
        // The row of the simple lexicon, the notice of the detailed one, the entity filed
        // under the unified code of the detailed entry.
        ['H0430G', 'Dieu (simple-fr)', 'Dieu, divinité (core)', 'Éternel bref'],
        // No notice, no entity: the row alone.
        ['H0430H', 'dieux (simple-fr)', undefined, undefined],
      ])
      assert.deepEqual(told('H0430 en'), [
        ['H0430G', 'God (simple-en)', '<p>notice of God</p> (core)', 'LORD brief'],
        ['H0430H', 'gods (simple-en)', undefined, undefined],
      ])
      assert.deepEqual(read.get('h430 fr')!.value, read.get('H0430 fr')!.value)
      assert.deepEqual(read.get('H430 en')!.value, read.get('H0430 en')!.value)

      // A letter in another case is another sense; each has the entity filed under its own
      // code, or else the one filed under the code its number shares.
      assert.deepEqual(told('H2148 fr'), [
        ['H2148A', 'Zacharie (simple-fr)', '<p>fils</p> (core)', 'Zechariah of the number brief'],
        ['H2148V', 'Zechariah (simple-fr)', '<p>notice of Zechariah</p> (core)', 'le prophète'],
        [
          'H2148v',
          'Zechariah (simple-fr)',
          '<p>notice of Zechariah</p> (core)',
          'Zechariah of the number brief',
        ],
      ])
      // A number that is the code of one of its senses lists it with the others. Without an
      // entity under its codes, a sense has the one filed under its number and named like it.
      assert.deepEqual(told('G2455 fr'), [
        ['G2455', 'Judas (simple-fr)', '<p>html</p> (core)', 'Judas the disciple'],
        ['G2455G', 'Judas (simple-fr)', '<p>notice of Judas</p> (core)', 'Judas the disciple'],
        ['G2455H', 'Judah (simple-fr)', '<p>notice of Judah</p> (core)', ''],
      ])
      // The entity of a sense is looked for under the number of its detailed entry.
      assert.deepEqual(told('H8138 fr'), [
        ['H8138A', 'to change (simple-fr)', '<p>notice of to change</p> (core)', undefined],
        [
          'H8138B',
          'to repeat (simple-fr)',
          '<p>notice of to repeat</p> (core)',
          'rangé avec le numéro détaillé',
        ],
      ])
      assert.deepEqual(told('H8139 fr'), [])
      // A sense the detailed lexicon carries under another identity, and one it does not hold.
      assert.deepEqual(told('H7000 en'), [
        [
          'H7000A',
          'carried (simple-en)',
          '<p>notice of carried</p> (core)',
          'of the carried sense',
        ],
        ['H7000B', 'absent (simple-en)', undefined, undefined],
      ])
      // A code written loosely is read as its normalised spelling. The senses come in the
      // order their codes were answered: the number itself is answered by its first sense.
      assert.deepEqual(told('H0701 en'), [
        ['H0701B', 'well written (simple-en)', '<p>notice of well written</p> (core)', undefined],
        [
          'H701A',
          'loosely written (simple-en)',
          '<p>notice of loosely written</p> (core)',
          undefined,
        ],
      ])
      // An entry of another number, and an entry without identity, are no senses.
      assert.deepEqual(
        told('H9000 en').map(([code]) => code),
        ['H9000A']
      )
      assert.deepEqual(
        told('H0085 fr').map(([code]) => code),
        ['H0085']
      )
      assert.deepEqual(told('H9999 fr'), [])

      // Entities published for another detailed lexicon are not read.
      await setStatus(database, entities, 'staged')
      await insertEntities(database, { revision: 'entities-r2', coreRevision: 'core-r0' })
      const incompatible = await everyNumber()
      assert.ok(
        [...incompatible.values()].every(outcome =>
          outcome.value!.value.senses.every(sense => sense.entityBrief === undefined)
        )
      )
      assert.match(
        incompatible.get('H0430 fr')!.value!.revision,
        /\|entities:incompatible:entities-r2:core-r0$/u
      )

      // A new revision of either lexicon is read as soon as it is the active one.
      await setStatus(database, simpleFr, 'staged')
      await setStatus(database, core, 'staged')
      const unavailable = await senses('H0430', 'fr')
      assert.equal(unavailable.failure, 'ActiveStrongLexiconPublicationUnavailable')
      await insertLexicon(database, 'simple-fr', { revision: 'simple-fr-r3' })
      await insertLexicon(database, 'core', { revision: 'core-r0' })
      const renewed = (await senses('H0430', 'fr')).value!
      assert.equal(
        renewed.revision,
        'strong-lexicon-number-senses-v1|simple:simple-fr-r3|core:core-r0|entities:available:entities-r2:core-r0'
      )
      assert.deepEqual(
        renewed.value.senses.map(sense => [
          sense.gloss,
          sense.detailedDefinitionHtml,
          sense.entityBrief,
        ]),
        [
          ['Dieu (simple-fr simple-fr-r3)', 'Dieu, divinité (core core-r0)', 'Éternel bref'],
          ['dieux (simple-fr simple-fr-r3)', undefined, undefined],
        ]
      )
    } finally {
      await isolated.dispose()
    }
  })
})
