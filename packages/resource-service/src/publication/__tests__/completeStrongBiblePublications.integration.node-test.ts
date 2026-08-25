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
    const importedVersions: string[] = []
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
      const manifest: StrongBiblePublicationBundleManifest = validated.manifest
      const canonical: CanonicalStrongBiblePublication = validated.canonical
      const versionId = manifest.identity.versionId
      const identity = getStrongBibleCatalogIdentity(versionId as StrongBibleVersionId)
      assert.equal(manifest.identity.datasetId, identity.datasetId)
      assert.equal(manifest.identity.language, identity.language)
      importedVersions.push(versionId)

      const isolated = await createIsolatedPostgres(
        connectionString,
        `strong_complete_${versionId.toLowerCase()}`
      )
      try {
        const repository = makeKyselyStrongBibleRepository(isolated.database)
        await isolated.database
          .insertInto('resource_publications')
          .values({
            resource_identity: manifest.dependencies.bible.resourceIdentity,
            resource_kind: 'bible-text',
            revision: manifest.dependencies.bible.revision,
            language: manifest.identity.language,
            status: 'active',
            canonical_sha256: '4'.repeat(64),
            offline_artifact_sha256: '5'.repeat(64),
            provenance: { source: 'integration-test', imported_at: new Date(0).toISOString() },
            rights: { holder: 'integration-test', online: true, offline: true },
            metadata: {
              text_revision: manifest.dependencies.bible.revision,
              text_sha256: manifest.dependencies.bible.textSha256,
            },
            activated_at: new Date(0),
          })
          .executeTakeFirstOrThrow()
        const imported = await Effect.runPromise(
          importPublicationBundle(bundlePath, isolated.database, {
            activateForLocalDevelopment: true,
          })
        )
        assert.ok(imported.status === 'activated' || imported.status === 'unchanged')
        const coverage = await Effect.runPromise(repository.findActiveCoverage(versionId))
        assert.equal(
          Object.values(coverage.verseCountByBookChapter).reduce(
            (count, chapterCount) => count + chapterCount,
            0
          ),
          manifest.counts.verses
        )
        const firstVerse = canonical.verses[0]!
        const chapter = await Effect.runPromise(
          repository.findActiveChapter({
            versionId,
            book: firstVerse.book,
            chapter: firstVerse.chapter,
          })
        )
        const expectedSpans = canonical.spans.filter(
          span => span.book === firstVerse.book && span.chapter === firstVerse.chapter
        )
        assert.equal(
          chapter.verses.reduce((count, verse) => count + verse.spans.length, 0),
          expectedSpans.length
        )
      } finally {
        await isolated.dispose()
      }
    }
    assert.equal(importedVersions.length, 12)
    assert.deepEqual(importedVersions.sort(), expectedVersions)
  })
})
