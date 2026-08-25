import assert from 'node:assert/strict'
import { readdir } from 'node:fs/promises'
import path from 'node:path'
import { describe, it } from 'node:test'

import { Effect } from 'effect'

import {
  BHG_INTERLINEAR_PUBLICATION_CATALOG,
  getInterlinearBiblePublicationLanguages,
} from '../../../../src/helpers/interlinearBiblePublicationCatalog'
import { createIsolatedPostgres } from '../../database/__tests__/isolatedPostgresTestSupport'
import { makeResourceWebHandler } from '../../http/app'
import { makeKyselyBibleChapterRepository } from '../../repositories/bibleChapterRepository'
import { makeKyselyInterlinearBibleRepository } from '../../repositories/interlinearBibleRepository'
import { importPublicationBundle } from '../../repositories/publicationImporter'
import {
  isBiblePublicationBundleManifest,
  isInterlinearBiblePublicationBundleManifest,
  validatePublicationBundle,
  type CanonicalInterlinearBiblePublication,
  type InterlinearBiblePublicationBundleManifest,
} from '../publicationBundle'

const root = process.env.RESOURCE_INTERLINEAR_BUNDLES_ROOT
const bhgBundleRoot = process.env.RESOURCE_BHG_BUNDLE_ROOT
const runIntegration =
  process.env.RESOURCE_INTEGRATION === '1' && Boolean(root) && Boolean(bhgBundleRoot)
const connectionString =
  process.env.RESOURCE_DATABASE_URL ??
  'postgresql://bible_strong:bible_strong@127.0.0.1:54329/bible_strong'

describe('Complete BHG interlinear publications', { skip: !runIntegration }, () => {
  it('validates, activates, imports, and queries both cataloged language indexes', async () => {
    const bundlePaths = (await readdir(path.resolve(root!), { withFileTypes: true }))
      .filter(entry => entry.isDirectory())
      .map(entry => path.join(path.resolve(root!), entry.name))
      .sort()
    const expectedLanguages = getInterlinearBiblePublicationLanguages()
    assert.equal(bundlePaths.length, expectedLanguages.length)

    const isolated = await createIsolatedPostgres(connectionString, 'interlinear_complete')
    const importedLanguages: string[] = []
    try {
      const bhgPublication = await validatePublicationBundle(path.resolve(bhgBundleRoot!))
      assert.ok(isBiblePublicationBundleManifest(bhgPublication.manifest))
      assert.equal(bhgPublication.manifest.identity.versionId, 'BHG')
      assert.equal(bhgPublication.canonical.format, 'bible-strong-canonical-bible')
      await Effect.runPromise(
        importPublicationBundle(path.resolve(bhgBundleRoot!), isolated.database, {
          activateForLocalDevelopment: true,
        })
      )

      const bibleRepository = makeKyselyBibleChapterRepository(isolated.database)
      const interlinearRepository = makeKyselyInterlinearBibleRepository(isolated.database)
      const web = makeResourceWebHandler(bibleRepository, undefined, {
        interlinearBible: interlinearRepository,
      })
      for (const bundlePath of bundlePaths) {
        const validated = await validatePublicationBundle(bundlePath)
        assert.ok(isInterlinearBiblePublicationBundleManifest(validated.manifest))
        assert.equal(validated.canonical.format, 'bible-strong-canonical-interlinear-index')
        if (
          !isInterlinearBiblePublicationBundleManifest(validated.manifest) ||
          validated.canonical.format !== 'bible-strong-canonical-interlinear-index'
        ) {
          assert.fail('Expected a BHG interlinear publication')
        }

        const manifest: InterlinearBiblePublicationBundleManifest = validated.manifest
        const canonical: CanonicalInterlinearBiblePublication = validated.canonical
        const language = manifest.identity.language
        const catalogArtifact = BHG_INTERLINEAR_PUBLICATION_CATALOG.indexes[language]
        importedLanguages.push(language)

        assert.equal(
          manifest.identity.versionId,
          BHG_INTERLINEAR_PUBLICATION_CATALOG.applicationVersionId
        )
        assert.equal(manifest.identity.datasetId, BHG_INTERLINEAR_PUBLICATION_CATALOG.datasetId)
        assert.equal(
          manifest.provenance.sourceVersion,
          BHG_INTERLINEAR_PUBLICATION_CATALOG.sourceVersion
        )
        assert.equal(manifest.rights.attribution, BHG_INTERLINEAR_PUBLICATION_CATALOG.attribution)
        assert.equal(manifest.rights.termsReference, BHG_INTERLINEAR_PUBLICATION_CATALOG.license)
        assert.equal(manifest.rights.online, true)
        assert.equal(manifest.rights.offline, true)
        assert.equal(manifest.deliveryCapabilities.onlineAccess, true)
        assert.equal(manifest.deliveryCapabilities.offlineDownload, true)
        assert.equal(manifest.counts.verses, BHG_INTERLINEAR_PUBLICATION_CATALOG.verseCount)
        assert.equal(manifest.counts.tokens, BHG_INTERLINEAR_PUBLICATION_CATALOG.tokenCount)
        assert.equal(manifest.counts.segments, BHG_INTERLINEAR_PUBLICATION_CATALOG.segmentCount)
        assert.equal(manifest.counts.identities, BHG_INTERLINEAR_PUBLICATION_CATALOG.identityCount)
        assert.equal(manifest.dependencies.bible.revision, catalogArtifact.textRevision)
        assert.equal(manifest.dependencies.bible.textSha256, catalogArtifact.textSha256)
        assert.equal(manifest.offlineArtifact.sha256, catalogArtifact.archiveSha256)
        assert.equal(manifest.offlineArtifact.bytes, catalogArtifact.archiveBytes)
        assert.equal(manifest.offlineArtifact.contentSha256, catalogArtifact.contentSha256)

        const imported = await Effect.runPromise(
          importPublicationBundle(bundlePath, isolated.database, {
            activateForLocalDevelopment: true,
          })
        )
        assert.ok(imported.status === 'activated' || imported.status === 'unchanged')

        const coverage = await Effect.runPromise(
          interlinearRepository.findActiveCoverage({ versionId: 'BHG', language })
        )
        assert.equal(
          Object.values(coverage.verseCountByBookChapter).reduce(
            (count, chapterCount) => count + chapterCount,
            0
          ),
          manifest.counts.verses
        )
        const firstVerse = canonical.verses[0]!
        const chapter = await Effect.runPromise(
          interlinearRepository.findActiveChapter({
            versionId: 'BHG',
            language,
            book: firstVerse.book,
            chapter: firstVerse.chapter,
          })
        )
        const chapterVerseIds = new Set(
          canonical.verses
            .filter(verse => verse.book === firstVerse.book && verse.chapter === firstVerse.chapter)
            .map(verse => verse.id)
        )
        assert.equal(
          chapter.verses.reduce((count, verse) => count + verse.tokens.length, 0),
          canonical.tokens.filter(token => chapterVerseIds.has(token.verseId)).length
        )

        const baseChapter = await Effect.runPromise(
          bibleRepository.findActiveChapter({
            versionId: 'BHG',
            book: firstVerse.book,
            chapter: firstVerse.chapter,
          })
        )
        assert.equal(baseChapter.textRevision, manifest.dependencies.bible.revision)
        assert.equal(baseChapter.textSha256, manifest.dependencies.bible.textSha256)

        const [baseResponse, interlinearResponse] = await Promise.all([
          web.handler(
            new Request(
              `http://resource.local/v1/bibles/BHG/books/${firstVerse.book}/chapters/${firstVerse.chapter}`
            )
          ),
          web.handler(
            new Request(
              `http://resource.local/v1/interlinear-bibles/BHG/languages/${language}/books/${firstVerse.book}/chapters/${firstVerse.chapter}`
            )
          ),
        ])
        assert.equal(baseResponse.status, 200)
        assert.equal(interlinearResponse.status, 200)
      }
    } finally {
      await isolated.dispose()
    }

    assert.deepEqual(importedLanguages.sort(), expectedLanguages)
  })
})
