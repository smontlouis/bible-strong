import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { Effect } from 'effect'

import { createIsolatedPostgres } from '../../database/__tests__/isolatedPostgresTestSupport'
import { makeKyselyStrongLexiconRepository } from '../strongLexiconRepository'

const runIntegration = process.env.RESOURCE_INTEGRATION === '1'
const connectionString =
  process.env.RESOURCE_DATABASE_URL ??
  'postgresql://bible_strong:bible_strong@127.0.0.1:54329/bible_strong'

describe('Strong lexicon PostgreSQL repository', { skip: !runIntegration }, () => {
  it('loads several entry cards with a statement count independent of the batch size', async () => {
    const isolated = await createIsolatedPostgres(connectionString, 'strong_cards', 1)
    const { database } = isolated

    try {
      const publication = await database
        .insertInto('resource_publications')
        .values({
          resource_identity: 'strong-lexicon:core',
          resource_kind: 'strong-lexicon',
          revision: 'core-r1',
          language: 'mul',
          status: 'active',
          canonical_sha256: '1'.repeat(64),
          offline_artifact_sha256: '2'.repeat(64),
          provenance: { source: 'integration-test', imported_at: new Date(0).toISOString() },
          rights: { holder: 'integration-test', online: true, offline: true },
          metadata: { resource_revision: 'core-r1' },
        })
        .returning('id')
        .executeTakeFirstOrThrow()

      const entries = [
        {
          id: 1,
          language: 'greek',
          code: 'G3056',
          identityCode: 'G3056',
          uStrong: 'G3056',
          baseCode: 3056,
          original: 'λόγος',
          transliteration: 'logos',
          gloss: 'word',
        },
        {
          id: 2,
          language: 'hebrew',
          code: 'H3068',
          identityCode: 'H3068',
          uStrong: 'H3068',
          baseCode: 3068,
          original: 'יהוה',
          transliteration: 'yhwh',
          gloss: 'Lord',
        },
        {
          id: 3,
          language: 'greek',
          code: 'G0026',
          identityCode: 'G0026',
          uStrong: 'G0026',
          baseCode: 26,
          original: 'ἀγάπη',
          transliteration: 'agapē',
          gloss: 'love',
        },
        {
          id: 4,
          language: 'greek',
          code: 'G2096',
          identityCode: 'G2096',
          uStrong: 'H2332',
          baseCode: 2096,
          original: 'Εὕα',
          transliteration: 'Heua',
          gloss: 'Eve',
        },
        {
          id: 5,
          language: 'hebrew',
          code: 'H2332',
          identityCode: 'H2332A',
          uStrong: 'H2332A',
          baseCode: 2332,
          original: 'חַוָּה',
          transliteration: 'chavvah',
          gloss: 'Eve',
        },
        {
          id: 6,
          language: 'hebrew',
          code: 'H8138A',
          identityCode: 'H8138A',
          uStrong: 'H8138A',
          baseCode: 8138,
          original: 'שָׁנָה',
          transliteration: 'shanah',
          gloss: 'changer',
        },
        {
          id: 7,
          language: 'hebrew',
          code: 'H8138B',
          identityCode: 'H8138B',
          uStrong: 'H8138B',
          baseCode: 8138,
          original: 'שָׁנָה',
          transliteration: 'shanah',
          gloss: 'répéter',
        },
        {
          id: 8,
          language: 'hebrew',
          code: 'H8141',
          identityCode: 'H8141',
          uStrong: 'H8141',
          baseCode: 8141,
          original: 'שָׁנָה',
          transliteration: 'shanah',
          gloss: 'année',
        },
      ] as const

      await database
        .insertInto('strong_lexicon_entries')
        .values(
          entries.map(entry => ({
            publication_id: publication.id,
            entry_id: entry.id,
            language: entry.language,
            e_strong: entry.code,
            d_strong: entry.code,
            u_strong: entry.code,
            payload: {
              id: entry.id,
              language: entry.language,
              eStrong: entry.code,
              dStrong: entry.code,
              uStrong: entry.uStrong,
              baseCode: entry.baseCode,
              original: entry.original,
              transliteration: entry.transliteration,
              classicTransliteration: entry.transliteration,
              gloss: entry.gloss,
              meaning: '',
              morph: '',
            },
          }))
        )
        .execute()
      await database
        .insertInto('strong_lexicon_entry_identities')
        .values(
          entries.map(entry => ({
            publication_id: publication.id,
            step_entry_id: entry.id,
            step_code: entry.identityCode,
          }))
        )
        .execute()
      await database
        .insertInto('strong_lexicon_relation_kinds')
        .values({
          publication_id: publication.id,
          relation_kind_id: 1,
          kind: 'derived_from',
          label_en: 'Derived from',
          label_fr: 'dérivé de',
          payload: {
            id: 1,
            kind: 'derived_from',
            labelEn: 'Derived from',
            labelFr: 'dérivé de',
          },
        })
        .execute()
      await database
        .insertInto('strong_lexicon_relations')
        .values({
          publication_id: publication.id,
          relation_id: 1,
          from_entry_id: 8,
          to_entry_id: null,
          relation_kind_id: 1,
          payload: {
            id: 1,
            fromStepEntryId: 8,
            toStepEntryId: null,
            toStepCode: 'H8138',
            groupKind: 'family',
            relationKindId: 1,
            sortOrder: 50,
          },
        })
        .execute()

      let statementCount = 0
      const instrumented = database.withPlugin({
        transformQuery(args) {
          statementCount += 1
          return args.node
        },
        async transformResult(args) {
          return args.result
        },
      })
      const repository = makeKyselyStrongLexiconRepository(instrumented)
      const cards = await Effect.runPromise(
        repository.findEntryCards!({
          identities: [
            { kind: 'strong', reference: 'G3056' },
            { kind: 'strong', reference: 'H3068' },
          ],
          language: 'fr',
        })
      )

      assert.equal(statementCount, 5)
      assert.deepEqual(
        cards.map(card => ({
          revision: card.revision,
          stepCode: card.value.stepCode,
          gloss: card.value.gloss,
        })),
        [
          { revision: 'core:core-r1', stepCode: 'G3056', gloss: 'word' },
          { revision: 'core:core-r1', stepCode: 'H3068', gloss: 'Lord' },
        ]
      )

      const classicalEve = await Effect.runPromise(
        repository.findEntryCards!({
          identities: [{ kind: 'strong', reference: 'H2332' }],
          language: 'fr',
        })
      )
      assert.deepEqual(
        classicalEve.map(card => ({
          selectedIdentity: card.value.selectedIdentity,
          classicStrong: card.value.classicStrong,
          language: card.value.language,
        })),
        [
          {
            selectedIdentity: { kind: 'strong', code: 'H2332' },
            classicStrong: 'H2332',
            language: 'hebrew',
          },
        ]
      )

      const normalizedTransliteration = await Effect.runPromise(
        repository.listEntries({ language: 'fr', search: 'agape', limit: 20 })
      )
      assert.deepEqual(
        normalizedTransliteration.value.entries.map(entry => entry.stepCode),
        ['G0026']
      )

      const derivedYear = await Effect.runPromise(
        repository.findEntry({ reference: 'H8141', language: 'fr' })
      )
      assert.deepEqual(
        derivedYear.value.relations.map(relation => ({
          label: relation.label,
          stepCode: relation.stepCode,
          gloss: relation.gloss,
        })),
        [
          { label: 'dérivé de', stepCode: 'H8138A', gloss: 'changer' },
          { label: 'dérivé de', stepCode: 'H8138B', gloss: 'répéter' },
        ]
      )
    } finally {
      await isolated.dispose()
    }
  })
})
