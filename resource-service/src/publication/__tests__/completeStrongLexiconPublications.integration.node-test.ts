import assert from 'node:assert/strict'
import path from 'node:path'
import { describe, it } from 'node:test'

import { Effect } from 'effect'

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
