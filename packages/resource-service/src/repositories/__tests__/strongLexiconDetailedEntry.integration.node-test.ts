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
type ModuleId = 'core' | 'resources' | 'entities'

const insertPublication = async (
  database: Database,
  moduleId: ModuleId,
  revision: string,
  options: { status?: 'active' | 'staged'; coreRevision?: string } = {}
) =>
  (
    await database
      .insertInto('resource_publications')
      .values({
        resource_identity: `strong-lexicon:${moduleId}`,
        resource_kind: 'strong-lexicon',
        revision,
        language: 'mul',
        status: options.status ?? 'active',
        canonical_sha256: '1'.repeat(64),
        offline_artifact_sha256: '2'.repeat(64),
        provenance: { source: 'integration-test', imported_at: new Date(0).toISOString() },
        rights: { holder: 'integration-test', online: true, offline: true },
        metadata:
          moduleId === 'core'
            ? { resource_revision: revision }
            : { dependencies: [{ revision: options.coreRevision ?? 'core-r1' }] },
      })
      .returning('id')
      .executeTakeFirstOrThrow()
  ).id

// The publication of a module that readers see: the previous one is staged again.
const activate = async (database: Database, moduleId: ModuleId, publicationId?: number) => {
  await database
    .updateTable('resource_publications')
    .set({ status: 'staged' })
    .where('resource_identity', '=', `strong-lexicon:${moduleId}`)
    .where('status', '=', 'active')
    .execute()
  if (publicationId === undefined) return
  await database
    .updateTable('resource_publications')
    .set({ status: 'active' })
    .where('id', '=', publicationId)
    .execute()
}

const entry = (
  id: number,
  stepCode: string,
  fields: {
    eStrong: string
    dStrong?: string
    uStrong?: string
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
    language: stepCode.startsWith('G') ? 'greek' : 'hebrew',
    baseCode: Number(fields.eStrong.replace(/\D/gu, '')),
    eStrong: fields.eStrong,
    dStrong: fields.dStrong ?? `${stepCode} =`,
    uStrong: fields.uStrong ?? stepCode,
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

const CORE_ENTRIES = [
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
  entry(5, 'H8141', { eStrong: 'H8141', gloss: 'year', morph: 'H:N-F' }),
  entry(6, 'H8138A', { eStrong: 'H8138a', gloss: 'to change' }),
  entry(7, 'H8138B', { eStrong: 'H8138b', gloss: 'to repeat' }),
  entry(8, 'G2455G', { eStrong: 'G2455', gloss: 'Judas', morph: 'N:N-M-P' }),
  entry(9, 'G2455H', { eStrong: 'G2455', gloss: 'Judas', morph: 'N:N-M-P' }),
  entry(10, 'G3056', { eStrong: 'G3056', gloss: 'word', morph: 'G:N-M' }),
  entry(11, 'H0059', { eStrong: 'H0059', gloss: 'Abel', morph: 'N:N--L' }),
  entry(12, 'H1008', { eStrong: 'H1008', gloss: 'Bethel', morph: 'N:N--L' }),
]

const CORE_TRANSLATIONS: Row[] = [
  { stepEntryId: 1, language: 'fr', gloss: 'Abraham', meaning: 'sens', meaningHtml: '<p>sens</p>' },
  { stepEntryId: 2, language: 'fr', gloss: 'Dieu', meaning: 'Dieu, divinité', meaningHtml: '' },
  { stepEntryId: 4, language: 'fr', gloss: 'Éternel', meaning: '', meaningHtml: '' },
  { stepEntryId: 6, language: 'fr', gloss: 'changer', meaning: '', meaningHtml: '' },
  { stepEntryId: 10, language: 'fr', gloss: 'parole', meaning: '', meaningHtml: '<p>parole</p>' },
  { stepEntryId: 10, language: 'en', gloss: 'ignored', meaning: 'ignored', meaningHtml: '' },
]

const RELATION_KINDS: Row[] = [
  { id: 1, kind: 'derived_from', labelEn: 'Derived from', labelFr: 'dérivé de' },
  { id: 2, kind: 'same_estrong', labelEn: 'Another sense', labelFr: '' },
  { id: 3, kind: 'name_of', labelEn: 'A name of', labelFr: 'un nom de' },
]

const relation = (
  id: number,
  from: number,
  to: number | string,
  groupKind: string,
  relationKindId: number,
  sortOrder: number
): Row => ({
  id,
  fromStepEntryId: from,
  toStepEntryId: typeof to === 'number' ? to : null,
  toStepCode: typeof to === 'number' ? CORE_ENTRIES[to - 1].stepCode : to,
  groupKind,
  relationKindId,
  sortOrder,
})

const CORE_RELATIONS: Row[] = [
  relation(1, 2, 3, 'subentry', 2, 30),
  relation(2, 2, 4, 'identity', 3, 10),
  // Same group and rank: their order is the one of the stored rows.
  relation(3, 2, 1, 'family', 1, 50),
  relation(4, 2, 5, 'family', 1, 50),
  relation(5, 2, 10, 'family', 1, 50),
  // A classical number names every sense of it; a combination of codes names nothing.
  relation(6, 5, 'H8138', 'family', 1, 50),
  relation(7, 5, 'G0737 (G0575+G0737)', 'identity', 1, 10),
  relation(8, 5, ' H0085 ', 'family', 1, 60),
  relation(9, 5, 'H-3068', 'family', 1, 70),
  relation(10, 10, 9, 'family', 1, 50),
  relation(11, 10, 8, 'family', 1, 50),
  relation(12, 10, 'g2455', 'subentry', 2, 30),
]

const MORPHOLOGY_CODES: Row[] = [
  {
    id: 1,
    code: 'N:N-M-P',
    normalizedCode: 'N:N-M-P',
    language: 'hebrew',
    scope: 'tagged_full',
    meaning: 'Tagged form',
    description: 'Not the lexical category.',
  },
  {
    id: 2,
    code: 'n:n-m-p',
    normalizedCode: 'N:N-M-P',
    language: 'name',
    scope: 'lexical_brief',
    meaning: 'Proper Name Masculine Person',
    description: 'Lexical category: a male person.',
  },
  {
    id: 3,
    code: 'N:N-M-P',
    normalizedCode: 'N:N-M-P',
    language: 'name',
    scope: 'lexical_brief',
    meaning: 'Later duplicate',
    description: 'Later duplicate.',
  },
  {
    id: 4,
    code: 'H:N-M',
    normalizedCode: 'H:N-M',
    language: 'hebrew',
    scope: 'lexical_brief',
    meaning: 'Hebrew Noun Masculine',
    description: 'hebrew  noun masculine',
  },
  {
    id: 5,
    code: 'G:N-M',
    normalizedCode: 'G:N-M',
    language: 'greek',
    scope: 'lexical_brief',
    meaning: 'Greek Noun Masculine',
    description: 'Lexical category: Greek Noun Masculine.',
  },
]

const MORPHOLOGY_TRANSLATIONS: Row[] = [
  {
    morphologyCodeId: 2,
    language: 'fr',
    meaning: 'Nom propre masculin de personne',
    description: 'Catégorie lexicale : une personne.',
  },
  { morphologyCodeId: 3, language: 'fr', meaning: 'Doublon', description: 'Doublon.' },
  { morphologyCodeId: 5, language: 'fr', meaning: 'Nom grec masculin', description: '' },
]

const insertCore = async (
  database: Database,
  publicationId: number,
  glossOf: (gloss: string) => string = gloss => gloss
) => {
  await database
    .insertInto('strong_lexicon_entries')
    .values(
      CORE_ENTRIES.map(({ payload }) => ({
        publication_id: publicationId,
        entry_id: payload.id,
        language: payload.language,
        e_strong: payload.eStrong,
        d_strong: payload.dStrong,
        u_strong: payload.uStrong,
        payload: { ...payload, gloss: glossOf(payload.gloss) },
      }))
    )
    .execute()
  await database
    .insertInto('strong_lexicon_entry_identities')
    .values(
      CORE_ENTRIES.map(({ stepCode, payload }) => ({
        publication_id: publicationId,
        step_entry_id: payload.id,
        step_code: stepCode,
      }))
    )
    .execute()
  await database
    .insertInto('strong_lexicon_translations')
    .values(
      CORE_TRANSLATIONS.map(payload => ({
        publication_id: publicationId,
        step_entry_id: Number(payload.stepEntryId),
        language: String(payload.language),
        payload,
      }))
    )
    .execute()
  await database
    .insertInto('strong_lexicon_relation_kinds')
    .values(
      RELATION_KINDS.map(payload => ({
        publication_id: publicationId,
        relation_kind_id: Number(payload.id),
        kind: String(payload.kind),
        label_en: String(payload.labelEn),
        label_fr: String(payload.labelFr),
        payload,
      }))
    )
    .execute()
  await database
    .insertInto('strong_lexicon_relations')
    .values(
      CORE_RELATIONS.map(payload => ({
        publication_id: publicationId,
        relation_id: Number(payload.id),
        from_entry_id: Number(payload.fromStepEntryId),
        to_entry_id: payload.toStepEntryId === null ? null : Number(payload.toStepEntryId),
        relation_kind_id: Number(payload.relationKindId),
        payload,
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
        language: String(payload.language),
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
}

const insertResources = async (database: Database, publicationId: number, label: string) => {
  const resources: Row[] = [
    {
      id: 1,
      stepEntryId: 10,
      source: 'STEP',
      kind: 'note',
      contentHtml: 'LSJ has no entry for this word.',
    },
    {
      id: 2,
      stepEntryId: 10,
      source: 'TFLSJ',
      kind: 'classical_full',
      contentHtml: `<p>${label} article</p>`,
    },
    { id: 3, stepEntryId: 8, source: 'OTHER', kind: 'note', contentHtml: `<p>${label} note</p>` },
  ]
  await database
    .insertInto('strong_lexicon_resources')
    .values(
      resources.map(payload => ({
        publication_id: publicationId,
        resource_id: Number(payload.id),
        step_entry_id: Number(payload.stepEntryId),
        source: String(payload.source),
        kind: String(payload.kind),
        payload,
      }))
    )
    .execute()
  await database
    .insertInto('strong_lexicon_resource_translations')
    .values(
      [
        { resourceId: 2, language: 'fr', contentHtml: `<p>article ${label}</p>` },
        { resourceId: 2, language: 'en', contentHtml: '<p>ignored</p>' },
        { resourceId: 3, language: 'fr', contentHtml: '' },
      ].map(payload => ({
        publication_id: publicationId,
        resource_id: payload.resourceId,
        language: payload.language,
        payload,
      }))
    )
    .execute()
}

const entity = (
  id: number,
  uniqueName: string,
  uStrong: string,
  displayName: string,
  category = 'person',
  type = 'Male'
): Row => ({
  id,
  uniqueName,
  uStrong,
  displayName,
  category,
  type,
  description: `${displayName} description`,
  summaryHtml: `<p>${displayName} summary</p>`,
  briefest: displayName,
  brief: `${displayName} brief`,
  shortDescription: `${displayName} short description`,
  articleHtml: `<p>${displayName} article</p>`,
})

const insertEntities = async (
  database: Database,
  publicationId: number,
  nameOf: (name: string) => string = name => name
) => {
  const entities: Row[] = [
    entity(10, 'Abraham@Gen.11.26-1Pe', 'H0085', nameOf('Abraham')),
    entity(11, 'Sarah@Gen.11.29-1Pe', 'H8283', 'Sarah', 'person', 'Female'),
    entity(12, 'Bethel@Gen.12.8-Amo', 'H1008', 'Beth_el', 'place', 'Settlement'),
    entity(13, 'LORD@Gen.1.1-Rev', 'H3068G', 'LORD', 'being', 'Supernatural'),
    // Under the code of the entry, and under its extended code: the first one is kept.
    entity(20, 'Judas@Mat.10.4-Act', 'G2455', 'Judas Iscariot'),
    entity(21, 'Judas@Mat.10.3-Act', 'G2455G', 'Judas'),
    // Under the classical number only: the one named like the entry is kept.
    entity(30, 'Abel-meholah@Jdg.7.22-1Ki', 'H0059A', 'Abel-meholah', 'place', 'Settlement'),
    entity(31, 'Abel@2Sa.20.14-18', 'H0059B', ' Ábel ', 'place', 'Settlement'),
    entity(32, 'Abila@Luk.3.1', 'H0590', 'Abel', 'place', 'Region'),
  ]
  await database
    .insertInto('strong_lexicon_entities')
    .values(
      entities.map(payload => ({
        publication_id: publicationId,
        entity_id: Number(payload.id),
        unique_name: String(payload.uniqueName),
        u_strong: String(payload.uStrong),
        payload,
      }))
    )
    .execute()
  const translations: Row[] = [
    { id: 1, entityId: 10, language: 'fr', displayName: nameOf('Abraham (fr)'), brief: 'bref' },
    { id: 2, entityId: 11, language: 'fr', displayName: 'Sara', brief: '' },
    // Two translations of one entity: both reads use the same one, by stored record key.
    { id: 3, entityId: 13, language: 'fr', displayName: 'Éternel', brief: '' },
    { id: 4, entityId: 13, language: 'fr', displayName: 'Seigneur', brief: '' },
    { id: 5, entityId: 21, language: 'fr', displayName: 'Jude', brief: '' },
    { id: 6, entityId: 10, language: 'en', displayName: 'ignored', brief: 'ignored' },
  ]
  await database
    .insertInto('strong_lexicon_entity_translations')
    .values(
      translations.map(payload => ({
        publication_id: publicationId,
        translation_id: Number(payload.id),
        entity_id: Number(payload.entityId),
        language: String(payload.language),
        payload,
      }))
    )
    .execute()
  const relations: Row[] = [
    {
      fromEntityId: 10,
      relation: 'spouse',
      toUniqueName: 'Sarah@Gen.11.29-1Pe',
      toEntityId: 11,
      certainty: 'asserted',
    },
    // Named only, behind the name of another edition.
    {
      fromEntityId: 10,
      relation: 'place',
      toUniqueName: 'Luz@Gen.28.19|Bethel@Gen.12.8-Amo',
      toEntityId: null,
      certainty: 'possible',
    },
    {
      fromEntityId: 10,
      relation: 'worshipper',
      toUniqueName: 'LORD@Gen.1.1-Rev',
      toEntityId: 13,
      certainty: 'asserted',
    },
    {
      fromEntityId: 10,
      relation: 'child',
      toUniqueName: 'Unknown_child@Gen.25.2',
      toEntityId: null,
      certainty: 'asserted',
    },
    {
      fromEntityId: 10,
      relation: 'child',
      toUniqueName: 'Another_child@Gen.25.2',
      toEntityId: null,
      certainty: 'asserted',
    },
    {
      fromEntityId: 21,
      relation: 'namesake',
      toUniqueName: 'Judas@Mat.10.4-Act',
      toEntityId: 20,
      certainty: 'asserted',
    },
    {
      fromEntityId: 31,
      relation: 'near',
      toUniqueName: 'Abel-meholah@Jdg.7.22-1Ki',
      toEntityId: 30,
      certainty: 'possible',
    },
  ]
  await database
    .insertInto('strong_lexicon_entity_relations')
    .values(
      relations.map((payload, index) => ({
        publication_id: publicationId,
        relation_id: index + 1,
        from_entity_id: Number(payload.fromEntityId),
        to_entity_id: payload.toEntityId === null ? null : Number(payload.toEntityId),
        relation: String(payload.relation),
        payload,
      }))
    )
    .execute()
  await database
    .insertInto('strong_lexicon_entity_places')
    .values(
      [
        {
          entityId: 12,
          openBibleName: 'Beth_el',
          area: 'Benjamin',
          latitude: 31.93,
          longitude: 35.22,
          googleMapUrl: 'https://maps.example/bethel',
          palopenmapsUrl: '',
        },
        {
          entityId: 31,
          openBibleName: 'Abel',
          area: '',
          latitude: null,
          longitude: null,
          googleMapUrl: '',
          palopenmapsUrl: 'https://palopenmaps.example/abel',
        },
      ].map(payload => ({
        publication_id: publicationId,
        entity_id: payload.entityId,
        payload,
      }))
    )
    .execute()
}

type Repository = ReturnType<typeof makeKyselyStrongLexiconRepository>
type EntryInput = Parameters<Repository['findEntry']>[0]
type Outcome = {
  active?: Effect.Effect.Success<ReturnType<Repository['findEntry']>>
  failure?: string
}

const INPUTS: EntryInput[] = [
  { reference: 'H0085', language: 'fr' },
  { reference: 'H85', language: 'en' },
  { reference: 'H0085', language: 'fr', content: 'definitions' },
  { reference: 'H430', language: 'fr' },
  { reference: 'H430', language: 'en', kind: 'strong' },
  { reference: 'H0430G', language: 'fr' },
  { reference: 'h0430g', language: 'fr', kind: 'dstrong' },
  { reference: 'h0430g', language: 'fr' },
  { reference: 'H0430', language: 'fr', kind: 'dstrong' },
  { reference: 'H0430', language: 'fr', kind: 'estrong' },
  { reference: 'H3068G', language: 'fr', kind: 'ustrong' },
  { reference: 'H3068G', language: 'en' },
  { reference: 'H8141', language: 'fr' },
  { reference: 'H8141', language: 'en', content: 'definitions' },
  { reference: 'H8138a', language: 'fr', kind: 'estrong' },
  { reference: 'G2455G', language: 'fr' },
  { reference: 'G2455H', language: 'en' },
  { reference: 'G2455', language: 'fr' },
  { reference: 'G3056', language: 'fr' },
  { reference: 'G3056', language: 'en' },
  { reference: 'G3056', language: 'fr', content: 'definitions' },
  { reference: 'H0059', language: 'fr' },
  { reference: 'H1008', language: 'en' },
  { reference: 'H9999', language: 'fr' },
  { reference: 'H0430G', language: 'fr', kind: 'ustrong' },
  { reference: 'not a code', language: 'fr' },
]

const readers = (database: Database) => {
  let statements = 0
  const sqlOf = (node: unknown): string => {
    const raw = node as { kind?: string; sqlFragments?: string[]; parameters?: unknown[] }
    return raw?.kind === 'RawNode'
      ? [...(raw.sqlFragments ?? []), ...(raw.parameters ?? []).map(sqlOf)].join(' ')
      : ''
  }
  let sql = ''
  const counted = database.withPlugin({
    transformQuery(args) {
      statements += 1
      sql += sqlOf(args.node)
      return args.node
    },
    async transformResult(args) {
      return args.result
    },
  })
  const oneStatement = makeKyselyStrongLexiconRepository(counted)
  const statementByStatement = makeKyselyStrongLexiconRepository(database, {
    detailedEntryRead: 'statement-by-statement',
  })
  const outcome = async (repository: Repository, input: EntryInput): Promise<Outcome> =>
    Exit.match(await Effect.runPromiseExit(repository.findEntry(input)), {
      onSuccess: active => ({ active }),
      onFailure: cause => ({
        failure: Option.match(Cause.failureOption(cause), {
          onNone: () => 'defect',
          onSome: error => error._tag,
        }),
      }),
    })
  return {
    // Reads one entry both ways and returns it once they agree.
    read: async (input: EntryInput) => {
      statements = 0
      sql = ''
      const actual = await outcome(oneStatement, input)
      const read = { statements, sql }
      const expected = await outcome(statementByStatement, input)
      assert.deepEqual(actual, expected, JSON.stringify(input))
      // The wire form too: key order and absent keys are part of the response.
      assert.equal(JSON.stringify(actual), JSON.stringify(expected), JSON.stringify(input))
      return { ...actual, ...read }
    },
  }
}

describe('Strong lexicon detailed entry', { skip: !runIntegration }, () => {
  it('reads an entry in one statement, equal to the statement-by-statement read', async () => {
    const isolated = await createIsolatedPostgres(connectionString, 'strong_entry', 1)
    const { database } = isolated

    try {
      await insertCore(database, await insertPublication(database, 'core', 'core-r1'))
      await insertResources(
        database,
        await insertPublication(database, 'resources', 'resources-r1'),
        'first'
      )
      await insertEntities(database, await insertPublication(database, 'entities', 'entities-r1'))
      const { read } = readers(database)

      const outcomes = new Map<string, Awaited<ReturnType<typeof read>>>()
      for (const input of INPUTS) {
        const outcome = await read(input)
        assert.equal(outcome.statements, 1, JSON.stringify(input))
        outcomes.set(JSON.stringify(input), outcome)
      }
      const valueOf = (input: EntryInput) => {
        const outcome = outcomes.get(JSON.stringify(input))
        assert.ok(outcome?.active, JSON.stringify(input))
        return outcome.active.value
      }

      for (const input of [
        { reference: 'H9999', language: 'fr' },
        { reference: 'H0430G', language: 'fr', kind: 'ustrong' },
        { reference: 'not a code', language: 'fr' },
      ] as const) {
        assert.equal(outcomes.get(JSON.stringify(input))?.failure, 'StrongLexiconEntryNotFound')
      }

      // A classical number selects its first sense; a code in another case, its entry.
      assert.equal(valueOf({ reference: 'H430', language: 'fr' }).stepCode, 'H0430G')
      assert.deepEqual(
        valueOf({ reference: 'h0430g', language: 'fr', kind: 'dstrong' }).selectedIdentity,
        { kind: 'dstrong', code: 'H0430G' }
      )
      assert.equal(valueOf({ reference: 'G2455', language: 'fr' }).stepCode, 'G2455G')

      const abraham = valueOf({ reference: 'H0085', language: 'fr' })
      assert.deepEqual(abraham.morphology, {
        code: 'N:N-M-P',
        meaning: 'Nom propre masculin de personne',
        description: 'Catégorie lexicale : une personne.',
      })
      assert.equal(abraham.nameMeaningHtml, '« père d’une multitude »')
      assert.equal(abraham.entity?.name, 'Abraham (fr)')
      assert.deepEqual(
        abraham.entity?.relations.map(related => [
          related.relation,
          related.targetName,
          related.targetStepCodes,
        ]),
        [
          ['child', 'Unknown child@Gen.25.2', undefined],
          ['child', 'Another child@Gen.25.2', undefined],
          ['place', 'Beth el', ['H1008']],
          ['spouse', 'Sara', undefined],
          ['worshipper', 'Seigneur', ['H0430G', 'H3068G']],
        ]
      )

      // Relations: stored order within one rank, every sense of a classical number.
      assert.deepEqual(
        valueOf({ reference: 'H0430G', language: 'fr' }).relations.map(related => [
          related.group,
          related.stepCode,
          related.label,
        ]),
        [
          ['family', 'H8141', 'dérivé de'],
          ['family', 'G3056', 'dérivé de'],
          ['family', 'H0085', 'dérivé de'],
          ['identity', 'H3068G', 'un nom de'],
          ['subentry', 'H0430H', 'Another sense'],
        ]
      )
      assert.deepEqual(
        valueOf({ reference: 'H8141', language: 'fr' }).relations.map(related => [
          related.stepCode,
          related.gloss,
        ]),
        [
          ['H8138A', 'changer'],
          ['H8138B', 'to repeat'],
          ['H0085', 'Abraham'],
        ]
      )

      const word = valueOf({ reference: 'G3056', language: 'fr' })
      assert.deepEqual(
        word.resources.map(resource => resource.contentHtml),
        ['<p>article first</p>']
      )
      assert.equal(word.lsjAbsent, true)
      assert.equal(word.entity, undefined)
      assert.deepEqual(
        word.relations.map(related => related.stepCode),
        ['G2455G', 'G2455H', 'G2455G', 'G2455H']
      )

      // Entities: under the code of the entry first, else named like it under its number.
      assert.equal(
        valueOf({ reference: 'G2455G', language: 'fr' }).entity?.uniqueName,
        'Judas@Mat.10.3-Act'
      )
      assert.equal(
        valueOf({ reference: 'G2455H', language: 'en' }).entity?.uniqueName,
        'Judas@Mat.10.4-Act'
      )
      const abel = valueOf({ reference: 'H0059', language: 'fr' }).entity
      assert.equal(abel?.uniqueName, 'Abel@2Sa.20.14-18')
      assert.deepEqual(abel?.place, {
        name: 'Abel',
        area: '',
        palopenmapsUrl: 'https://palopenmaps.example/abel',
      })
      assert.equal(valueOf({ reference: 'H1008', language: 'en' }).entity?.place?.latitude, 31.93)

      // Definitions alone leave the addon tables unread, and keep the revision of the entry.
      const definitions = outcomes.get(
        JSON.stringify({ reference: 'G3056', language: 'fr', content: 'definitions' })
      )
      const complete = outcomes.get(JSON.stringify({ reference: 'G3056', language: 'fr' }))
      assert.doesNotMatch(definitions?.sql ?? '', /strong_lexicon_(resources|entit)/u)
      assert.match(complete?.sql ?? '', /strong_lexicon_resources[\s\S]*strong_lexicon_entities/u)
      assert.deepEqual(definitions?.active?.value.resources, [])
      assert.equal(definitions?.active?.value.lsjAbsent, false)
      assert.ok(definitions?.active?.revision)
      assert.equal(definitions.active.revision, complete?.active?.revision)
    } finally {
      await isolated.dispose()
    }
  })

  it('reflects the activation of another publication of any one module', async () => {
    const isolated = await createIsolatedPostgres(connectionString, 'strong_entry_modules', 1)
    const { database } = isolated

    try {
      await insertCore(database, await insertPublication(database, 'core', 'core-r1'))
      await insertResources(
        database,
        await insertPublication(database, 'resources', 'resources-r1'),
        'first'
      )
      await insertEntities(database, await insertPublication(database, 'entities', 'entities-r1'))
      const { read } = readers(database)
      const word = async () => {
        const outcome = await read({ reference: 'G3056', language: 'fr' })
        assert.ok(outcome.active)
        return outcome.active
      }
      const abraham = async () => {
        const outcome = await read({ reference: 'H0085', language: 'fr' })
        assert.ok(outcome.active)
        return outcome.active
      }
      const revisionOf = (core: string, resources: string, entities: string) =>
        [
          'strong-lexicon-case-sensitive-definition-levels-v2',
          `core:${core}`,
          `resources:${resources}`,
          `entities:${entities}`,
        ].join('|')

      assert.equal(
        (await word()).revision,
        revisionOf('core-r1', 'available:resources-r1:core-r1', 'available:entities-r1:core-r1')
      )

      // Another dictionary publication, the two other modules untouched.
      const secondResources = await insertPublication(database, 'resources', 'resources-r2', {
        status: 'staged',
      })
      await insertResources(database, secondResources, 'second')
      assert.equal((await word()).value.resources[0].contentHtml, '<p>article first</p>')
      await activate(database, 'resources', secondResources)
      const withSecondResources = await word()
      assert.equal(withSecondResources.value.resources[0].contentHtml, '<p>article second</p>')
      assert.equal(
        withSecondResources.revision,
        revisionOf('core-r1', 'available:resources-r2:core-r1', 'available:entities-r1:core-r1')
      )
      assert.equal((await abraham()).value.entity?.name, 'Abraham (fr)')

      // Another entities publication.
      const secondEntities = await insertPublication(database, 'entities', 'entities-r2', {
        status: 'staged',
      })
      await insertEntities(database, secondEntities, name => `${name} II`)
      await activate(database, 'entities', secondEntities)
      const withSecondEntities = await abraham()
      assert.equal(withSecondEntities.value.entity?.name, 'Abraham (fr) II')
      assert.equal(
        withSecondEntities.revision,
        revisionOf('core-r1', 'available:resources-r2:core-r1', 'available:entities-r2:core-r1')
      )
      assert.equal((await word()).value.resources[0].contentHtml, '<p>article second</p>')

      // A dictionary built for another core is not read.
      const foreignResources = await insertPublication(database, 'resources', 'resources-r3', {
        status: 'staged',
        coreRevision: 'core-r0',
      })
      await insertResources(database, foreignResources, 'foreign')
      await activate(database, 'resources', foreignResources)
      const withForeignResources = await word()
      assert.deepEqual(withForeignResources.value.resources, [])
      assert.equal(withForeignResources.value.lsjAbsent, false)
      assert.deepEqual(withForeignResources.value.modules.resources, {
        moduleId: 'resources',
        status: 'incompatible',
        revision: 'resources-r3',
        dependencyRevision: 'core-r0',
      })
      assert.equal(
        withForeignResources.revision,
        revisionOf('core-r1', 'incompatible:resources-r3:core-r0', 'available:entities-r2:core-r1')
      )

      // No active dictionary at all.
      await activate(database, 'resources')
      const withoutResources = await word()
      assert.deepEqual(withoutResources.value.modules.resources, {
        moduleId: 'resources',
        status: 'unavailable',
      })
      assert.equal(
        withoutResources.revision,
        revisionOf('core-r1', 'unavailable::', 'available:entities-r2:core-r1')
      )

      // Another core: its entries are served, and the addons built for the first one are not.
      const secondCore = await insertPublication(database, 'core', 'core-r2', { status: 'staged' })
      await insertCore(database, secondCore, gloss => `${gloss} II`)
      await activate(database, 'resources', secondResources)
      await activate(database, 'core', secondCore)
      const withSecondCore = await abraham()
      assert.equal(withSecondCore.value.gloss, 'Abraham')
      assert.equal(
        (await read({ reference: 'H0085', language: 'en' })).active?.value.gloss,
        'Abraham II'
      )
      assert.equal(withSecondCore.value.entity, undefined)
      assert.equal(withSecondCore.value.modules.entities.status, 'incompatible')
      assert.equal(
        withSecondCore.revision,
        revisionOf(
          'core-r2',
          'incompatible:resources-r2:core-r1',
          'incompatible:entities-r2:core-r1'
        )
      )

      // Without an active core the entry is unavailable, whatever the addons.
      await activate(database, 'core')
      assert.equal(
        (await read({ reference: 'H0085', language: 'fr' })).failure,
        'ActiveStrongLexiconPublicationUnavailable'
      )
    } finally {
      await isolated.dispose()
    }
  })
})
