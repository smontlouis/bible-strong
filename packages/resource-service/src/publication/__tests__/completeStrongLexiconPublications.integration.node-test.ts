import assert from 'node:assert/strict'
import path from 'node:path'
import { describe, it } from 'node:test'

import { Effect } from 'effect'
import { sql } from 'kysely'

import { createIsolatedPostgres } from '../../database/__tests__/isolatedPostgresTestSupport'
import { makeKyselyStrongLexiconRepository } from '../../repositories/strongLexiconRepository'
import { importPublicationBundle } from '../../repositories/publicationImporter'
import {
  isStrongLexiconPublicationBundleManifest,
  validatePublicationBundle,
} from '../publicationBundle'

const root = process.env.RESOURCE_STRONG_LEXICON_BUNDLES_ROOT
const runIntegration = process.env.RESOURCE_INTEGRATION === '1' && Boolean(root)
const connectionString =
  process.env.RESOURCE_DATABASE_URL ??
  'postgresql://bible_strong:bible_strong@127.0.0.1:54329/bible_strong'

describe('Complete Strong lexicon publications', { skip: !runIntegration }, () => {
  it('validates, atomically activates, and queries all three independent modules', async () => {
    const isolated = await createIsolatedPostgres(connectionString, 'strong_lexicon_complete')
    try {
      for (const moduleId of ['core', 'entities', 'resources'] as const) {
        const bundle = path.join(path.resolve(root!), moduleId)
        const validated = await validatePublicationBundle(bundle)
        assert.ok(isStrongLexiconPublicationBundleManifest(validated.manifest))
        assert.equal(validated.manifest.identity.moduleId, moduleId)
        assert.equal(validated.canonical.format, 'bible-strong-canonical-strong-lexicon-module')
        const imported = await Effect.runPromise(
          importPublicationBundle(bundle, isolated.database, {
            activateForLocalDevelopment: true,
          })
        )
        assert.equal(imported.status, 'activated')
      }

      const repository = makeKyselyStrongLexiconRepository(isolated.database)
      const entry = await Effect.runPromise(
        repository.findEntry({ reference: 'G3056', language: 'fr' })
      )
      assert.equal(entry.value.stepCode, 'G3056')
      assert.equal(entry.value.gloss, 'parole')
      assert.ok(entry.value.resources.length > 0)
      assert.equal(entry.value.modules.resources.status, 'available')
      assert.equal(entry.value.modules.entities.status, 'available')

      const paul = await Effect.runPromise(
        repository.findEntry({ reference: 'G4569G', language: 'fr' })
      )
      assert.equal(
        paul.value.nameMeaningHtml,
        'Saül, « demandé » ou <i>peut-être</i> « consacré à Dieu »'
      )

      const entity = await Effect.runPromise(
        repository.findEntity({ uniqueName: 'Adam@Gen.2.19-Jud', language: 'fr' })
      )
      assert.equal(entity.value.name, 'Adam')
      assert.ok(entity.value.relations.length > 0)

      const search = await Effect.runPromise(
        repository.listEntries({ language: 'fr', search: 'parole', limit: 10 })
      )
      assert.ok(search.value.entries.length > 0)

      // The one-statement read of a detailed entry matches rows through the typed columns:
      // they must hold the payload fields they are projected from.
      const unprojected = await sql<{ rows: string }>`
        SELECT (
          SELECT count(*) FROM strong_lexicon_entries
           WHERE entry_id IS DISTINCT FROM (payload->>'id')::integer
              OR language IS DISTINCT FROM payload->>'language'
              OR e_strong IS DISTINCT FROM payload->>'eStrong'
              OR d_strong IS DISTINCT FROM payload->>'dStrong'
              OR u_strong IS DISTINCT FROM payload->>'uStrong'
        ) + (
          SELECT count(*) FROM strong_lexicon_relations
           WHERE from_entry_id IS DISTINCT FROM (payload->>'fromStepEntryId')::integer
              OR to_entry_id IS DISTINCT FROM (payload->>'toStepEntryId')::integer
        ) + (
          SELECT count(*) FROM strong_lexicon_morphology_codes
           WHERE morphology_code_id IS DISTINCT FROM (payload->>'id')::integer
              OR scope IS DISTINCT FROM payload->>'scope'
              OR code IS DISTINCT FROM payload->>'code'
              OR normalized_code IS DISTINCT FROM payload->>'normalizedCode'
        ) + (
          SELECT count(*) FROM strong_lexicon_resources
           WHERE resource_id IS DISTINCT FROM (payload->>'id')::integer
              OR step_entry_id IS DISTINCT FROM (payload->>'stepEntryId')::integer
        ) + (
          SELECT count(*) FROM strong_lexicon_entities
           WHERE entity_id IS DISTINCT FROM (payload->>'id')::integer
              OR unique_name IS DISTINCT FROM payload->>'uniqueName'
              OR u_strong IS DISTINCT FROM payload->>'uStrong'
        ) + (
          SELECT count(*) FROM strong_lexicon_entity_relations
           WHERE from_entity_id IS DISTINCT FROM (payload->>'fromEntityId')::integer
              OR to_entity_id IS DISTINCT FROM (payload->>'toEntityId')::integer
        ) AS rows
      `.execute(isolated.database)
      assert.equal(Number(unprojected.rows[0].rows), 0)

      // Both reads of a detailed entry return the same response: every fiftieth entry,
      // by its own code and by its classical number.
      const statementByStatement = makeKyselyStrongLexiconRepository(isolated.database, {
        detailedEntryRead: 'statement-by-statement',
      })
      const sampled = await sql<{ step_code: string; classical: string }>`
        SELECT i.step_code,
               CASE WHEN e.language = 'greek' THEN 'G' ELSE 'H' END
               || (e.payload->>'baseCode') AS classical
          FROM strong_lexicon_entries e
          JOIN strong_lexicon_entry_identities i
            ON i.publication_id = e.publication_id AND i.step_entry_id = e.entry_id
         WHERE e.entry_id % 50 = 0
         ORDER BY e.entry_id
      `.execute(isolated.database)
      assert.ok(sampled.rows.length > 400)
      const wireForm = async (
        reader: typeof repository,
        input: Parameters<typeof repository.findEntry>[0]
      ) => JSON.stringify(await Effect.runPromise(reader.findEntry(input)))
      let withEntity = 0
      for (const { step_code: stepCode, classical } of sampled.rows) {
        for (const input of [
          { reference: stepCode, language: 'fr' },
          { reference: stepCode, language: 'en', content: 'definitions' },
          { reference: classical, language: 'en' },
        ] as const) {
          const expected = await wireForm(statementByStatement, input)
          assert.equal(await wireForm(repository, input), expected, JSON.stringify(input))
          if (expected.includes('"entity":{')) withEntity += 1
        }
      }
      assert.ok(withEntity > 50)

      // Both reads of entry cards return the same response too: the same entries, by their
      // own code, by their classical number, and as the senses a number may have.
      const cardsStatementByStatement = makeKyselyStrongLexiconRepository(isolated.database, {
        entryCardsRead: 'statement-by-statement',
      })
      const cardsWireForm = async (
        reader: typeof repository,
        input: Parameters<NonNullable<typeof repository.findEntryCards>>[0]
      ) => JSON.stringify(await Effect.runPromise(reader.findEntryCards!(input)))
      const senseSuffixes = ['', ...'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz']
      let cards = 0
      for (const { step_code: stepCode, classical } of sampled.rows) {
        for (const input of [
          {
            identities: [
              { kind: 'dstrong', reference: stepCode },
              { kind: 'strong', reference: classical },
              { kind: 'dstrong', reference: stepCode.toLowerCase() },
            ],
            language: 'fr',
          },
          {
            identities: senseSuffixes.map(suffix => ({
              kind: 'dstrong' as const,
              reference: `${stepCode.replace(/[A-Za-z]+$/u, '')}${suffix}`,
            })),
            language: 'en',
          },
        ] as const) {
          const expected = await cardsWireForm(cardsStatementByStatement, {
            ...input,
            identities: [...input.identities],
          })
          assert.equal(
            await cardsWireForm(repository, { ...input, identities: [...input.identities] }),
            expected,
            JSON.stringify(input)
          )
          cards += expected.split('"selectedIdentity"').length - 1
        }
      }
      assert.ok(cards > sampled.rows.length * 3)

      const entitiesPublication = await isolated.database
        .selectFrom('resource_publications')
        .select('id')
        .where('resource_identity', '=', 'strong-lexicon:entities')
        .executeTakeFirstOrThrow()
      await isolated.database
        .deleteFrom('resource_publications')
        .where('id', '=', entitiesPublication.id)
        .executeTakeFirstOrThrow()
      const remainingEntityRelations = await isolated.database
        .selectFrom('strong_lexicon_entity_relations')
        .select(({ fn }) => fn.countAll<number>().as('count'))
        .where('publication_id', '=', entitiesPublication.id)
        .executeTakeFirstOrThrow()
      assert.equal(Number(remainingEntityRelations.count), 0)

      const corePublication = await isolated.database
        .selectFrom('resource_publications')
        .select('id')
        .where('resource_identity', '=', 'strong-lexicon:core')
        .executeTakeFirstOrThrow()
      await isolated.database
        .deleteFrom('resource_publications')
        .where('id', '=', corePublication.id)
        .executeTakeFirstOrThrow()
      const remainingRelations = await isolated.database
        .selectFrom('strong_lexicon_relations')
        .select(({ fn }) => fn.countAll<number>().as('count'))
        .where('publication_id', '=', corePublication.id)
        .executeTakeFirstOrThrow()
      assert.equal(Number(remainingRelations.count), 0)
    } finally {
      await isolated.dispose()
    }
  })
})
