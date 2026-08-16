import assert from 'node:assert/strict'
import { readdir } from 'node:fs/promises'
import path from 'node:path'
import { describe, it } from 'node:test'

import { Effect } from 'effect'

import { getMobileStrongBibleVersionIds } from '../../../../src/helpers/mobileResourceCatalog'
import {
  getStrongBibleCatalogIdentity,
  type StrongBibleVersionId,
} from '../../../../src/helpers/strongBibleCatalog'
import { createIsolatedPostgres } from '../../database/__tests__/isolatedPostgresTestSupport'
import { makeKyselyStrongBibleRepository } from '../../repositories/strongBibleRepository'
import { importPublicationBundle } from '../../repositories/publicationImporter'
import {
  isStrongBiblePublicationBundleManifest,
  validatePublicationBundle,
  type CanonicalStrongBiblePublication,
  type StrongBiblePublicationBundleManifest,
} from '../publicationBundle'

const root = process.env.RESOURCE_STRONG_BIBLE_BUNDLES_ROOT
const runIntegration = process.env.RESOURCE_INTEGRATION === '1' && Boolean(root)
const connectionString =
  process.env.RESOURCE_DATABASE_URL ??
  'postgresql://bible_strong:bible_strong@127.0.0.1:54329/bible_strong'

describe('Complete Strong Bible publications', { skip: !runIntegration }, () => {
  it('validates, activates, imports, and queries all 12 current Strong indexes', async () => {
    const bundlePaths = (await readdir(path.resolve(root!), { withFileTypes: true }))
      .filter(entry => entry.isDirectory())
      .map(entry => path.join(path.resolve(root!), entry.name))
      .sort()
    const expectedVersions = getMobileStrongBibleVersionIds()
    const isolated = await createIsolatedPostgres(connectionString, 'strong_complete')
    try {
      const publications: {
        bundlePath: string
        manifest: StrongBiblePublicationBundleManifest
        canonical: CanonicalStrongBiblePublication
      }[] = []
      for (const bundlePath of bundlePaths) {
        const validated = await validatePublicationBundle(bundlePath)
        assert.ok(isStrongBiblePublicationBundleManifest(validated.manifest))
        assert.equal(validated.canonical.format, 'bible-strong-canonical-strong-index')
        if (
          !isStrongBiblePublicationBundleManifest(validated.manifest) ||
          validated.canonical.format !== 'bible-strong-canonical-strong-index'
        ) {
          assert.fail('Expected a Strong Bible publication')
        }
        publications.push({
          bundlePath,
          manifest: validated.manifest,
          canonical: validated.canonical,
        })
      }
      assert.equal(publications.length, 12)
      assert.deepEqual(
        publications.map(publication => publication.manifest.identity.versionId).sort(),
        expectedVersions
      )
      for (const publication of publications) {
        const identity = getStrongBibleCatalogIdentity(
          publication.manifest.identity.versionId as StrongBibleVersionId
        )
        assert.equal(publication.manifest.identity.datasetId, identity.datasetId)
        assert.equal(publication.manifest.identity.language, identity.language)
      }

      for (const publication of publications) {
        await isolated.database
          .insertInto('resource_publications')
          .values({
            resource_identity: publication.manifest.dependencies.bible.resourceIdentity,
            resource_kind: 'bible-text',
            revision: publication.manifest.dependencies.bible.revision,
            language: publication.manifest.identity.language,
            status: 'active',
            canonical_sha256: '4'.repeat(64),
            offline_artifact_sha256: '5'.repeat(64),
            provenance: { source: 'integration-test', imported_at: new Date(0).toISOString() },
            rights: { holder: 'integration-test', online: true, offline: true },
            metadata: {
              text_revision: publication.manifest.dependencies.bible.revision,
              text_sha256: publication.manifest.dependencies.bible.textSha256,
            },
            activated_at: new Date(0),
          })
          .executeTakeFirstOrThrow()
        const imported = await Effect.runPromise(
          importPublicationBundle(publication.bundlePath, isolated.database, {
            activateForLocalDevelopment: true,
          })
        )
        assert.ok(imported.status === 'activated' || imported.status === 'unchanged')
      }

      const repository = makeKyselyStrongBibleRepository(isolated.database)
      for (const publication of publications) {
        const versionId = publication.manifest.identity.versionId
        const coverage = await Effect.runPromise(repository.findActiveCoverage(versionId))
        assert.equal(
          Object.values(coverage.verseCountByBookChapter).reduce(
            (count, chapterCount) => count + chapterCount,
            0
          ),
          publication.manifest.counts.verses
        )
        const firstVerse = publication.canonical.verses[0]!
        const chapter = await Effect.runPromise(
          repository.findActiveChapter({
            versionId,
            book: firstVerse.book,
            chapter: firstVerse.chapter,
          })
        )
        const expectedSpans = publication.canonical.spans.filter(
          span => span.book === firstVerse.book && span.chapter === firstVerse.chapter
        )
        assert.equal(
          chapter.verses.reduce((count, verse) => count + verse.spans.length, 0),
          expectedSpans.length
        )
      }
    } finally {
      await isolated.dispose()
    }
  })
})
