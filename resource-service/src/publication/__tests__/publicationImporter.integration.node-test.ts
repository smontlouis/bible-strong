import assert from 'node:assert/strict'
import { createHash, randomUUID } from 'node:crypto'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, it } from 'node:test'

import { Effect, Fiber } from 'effect'
import { strToU8, zipSync } from 'fflate'

import { makeLocalDatabase } from '../../database/localDatabase'
import { makeKyselyBibleChapterRepository } from '../../repositories/bibleChapterRepository'
import { importPublicationBundle } from '../../repositories/publicationImporter'
import { hashCanonicalVerses } from '../legacyBiblePublication'
import { derivePublicationRevision, type PublicationBundleManifest } from '../publicationBundle'

const runIntegration = process.env.RESOURCE_INTEGRATION === '1'
const connectionString =
  process.env.RESOURCE_DATABASE_URL ??
  'postgresql://bible_strong:bible_strong@127.0.0.1:54329/bible_strong'
const sha256 = (value: string | Buffer) => createHash('sha256').update(value).digest('hex')

const writeBundle = async ({
  root,
  versionId,
  text,
  countOverride,
  rightsHolder = 'integration-test',
  onlineAccess = true,
  localDevelopmentAccess = false,
  publicationRevisionOverride,
}: {
  root: string
  versionId: string
  text: string
  countOverride?: number
  rightsHolder?: string
  onlineAccess?: boolean
  localDevelopmentAccess?: boolean
  publicationRevisionOverride?: string
}) => {
  const sourceSha256 = '2'.repeat(64)
  const verses = {
    1: { 1: { 1: { text, startTags: [], layout: [], notes: [], headings: [] } } },
  }
  const textSha256 = hashCanonicalVerses(verses)
  const textRevision = `${versionId.toLowerCase()}-${textSha256.slice(0, 20)}`
  const canonical = `${JSON.stringify({
    format: 'bible-strong-canonical-bible',
    schemaVersion: 4,
    applicationVersionId: versionId,
    textRevision,
    textSha256,
    sourceVersion: 'integration-source',
    sourceSha256,
    verseCount: 1,
    noteCount: 0,
    headingCount: 0,
    verses,
  })}\n`
  const offline = Buffer.from(zipSync({ 'bible.json': strToU8(canonical) }))
  await mkdir(path.join(root, 'canonical'), { recursive: true })
  await mkdir(path.join(root, 'offline'), { recursive: true })
  await writeFile(path.join(root, 'canonical/bible.json'), canonical)
  await writeFile(path.join(root, 'offline/bible.zip'), offline)

  const manifestBase: PublicationBundleManifest = {
    format: 'bible-strong-resource-publication',
    schemaVersion: 1,
    identity: { kind: 'bible-text', versionId, language: 'fr' },
    revision: textRevision,
    canonical: {
      path: 'canonical/bible.json',
      mediaType: 'application/json',
      schemaVersion: 4,
      sha256: sha256(canonical),
      bytes: Buffer.byteLength(canonical),
    },
    offlineArtifact: {
      path: 'offline/bible.zip',
      entry: 'bible.json',
      mediaType: 'application/zip',
      sha256: sha256(offline),
      bytes: offline.byteLength,
      contentSha256: sha256(canonical),
    },
    provenance: {
      generator: 'bible-lexicon-maker',
      sourceVersion: 'integration-source',
      sourceSha256,
      generatedAt: new Date(0).toISOString(),
    },
    rights: {
      holder: rightsHolder,
      termsReference: 'integration-test',
      attribution: 'integration-test',
      online: onlineAccess,
      offline: true,
    },
    deliveryCapabilities: { onlineAccess, offlineDownload: true, localDevelopmentAccess },
    canon: { id: 'integration', orderedBooks: [1] },
    versification: 'integration',
    coverage: { chaptersByBook: { 1: [1] }, verseCountByBookChapter: { '1-1': 1 } },
    counts: { books: 1, chapters: 1, verses: countOverride ?? 1, notes: 0, headings: 0 },
  }
  const publicationRevision = publicationRevisionOverride ?? derivePublicationRevision(manifestBase)
  const manifest: PublicationBundleManifest = {
    ...manifestBase,
    publicationRevision,
  }
  await writeFile(path.join(root, 'manifest.json'), `${JSON.stringify(manifest)}\n`)
  return { publicationRevision, textRevision, textSha256 }
}

describe('Atomic publication import', { skip: !runIntegration }, () => {
  it('activates, idempotently reimports, replaces, and preserves the active revision on failure', async () => {
    const versionId = `TEST-${randomUUID()}`
    const identity = `bible-text:${versionId}`
    const firstBundle = await mkdtemp(path.join(tmpdir(), 'publication-first-'))
    const secondBundle = await mkdtemp(path.join(tmpdir(), 'publication-second-'))
    const invalidBundle = await mkdtemp(path.join(tmpdir(), 'publication-invalid-'))
    const interruptedBundle = await mkdtemp(path.join(tmpdir(), 'publication-interrupted-'))
    const collisionBundle = await mkdtemp(path.join(tmpdir(), 'publication-collision-'))
    const database = makeLocalDatabase({ connectionString, maxConnections: 1 })

    try {
      const firstPublication = await writeBundle({ root: firstBundle, versionId, text: 'First' })
      const secondPublication = await writeBundle({ root: secondBundle, versionId, text: 'Second' })
      await writeBundle({
        root: invalidBundle,
        versionId,
        text: 'Invalid',
        countOverride: 2,
      })
      await writeBundle({
        root: interruptedBundle,
        versionId,
        text: 'Must never activate',
      })
      await writeBundle({
        root: collisionBundle,
        versionId,
        text: 'Revision collision',
        publicationRevisionOverride: secondPublication.publicationRevision,
      })

      await assert.doesNotReject(
        Effect.runPromise(importPublicationBundle(firstBundle, database)).then(result => {
          assert.equal(result.status, 'activated')
        })
      )
      const unchanged = await Effect.runPromise(importPublicationBundle(firstBundle, database))
      assert.equal(unchanged.status, 'unchanged')
      const preHashMetadata = await database
        .selectFrom('resource_publications')
        .select('metadata')
        .where('resource_identity', '=', identity)
        .where('revision', '=', firstPublication.publicationRevision)
        .executeTakeFirstOrThrow()
      const { text_sha256: _removedTextSha256, ...legacyMetadata } = preHashMetadata.metadata
      await database
        .updateTable('resource_publications')
        .set({ metadata: legacyMetadata })
        .where('resource_identity', '=', identity)
        .where('revision', '=', firstPublication.publicationRevision)
        .executeTakeFirstOrThrow()
      const backfilled = await Effect.runPromise(importPublicationBundle(firstBundle, database))
      assert.equal(backfilled.status, 'unchanged')
      const backfilledPublication = await database
        .selectFrom('resource_publications')
        .select('metadata')
        .where('resource_identity', '=', identity)
        .where('revision', '=', firstPublication.publicationRevision)
        .executeTakeFirstOrThrow()
      assert.equal(backfilledPublication.metadata.text_sha256, firstPublication.textSha256)
      await writeBundle({
        root: firstBundle,
        versionId,
        text: 'First',
        rightsHolder: 'attempted-mutation',
        publicationRevisionOverride: firstPublication.publicationRevision,
      })
      await assert.rejects(
        Effect.runPromise(importPublicationBundle(firstBundle, database)),
        /PUBLICATION_BUNDLE_REVISION_INVALID/
      )
      const unchangedPublication = await database
        .selectFrom('resource_publications')
        .select('rights')
        .where('resource_identity', '=', identity)
        .where('revision', '=', firstPublication.publicationRevision)
        .executeTakeFirstOrThrow()
      assert.equal(unchangedPublication.rights.holder, 'integration-test')

      const replaced = await Effect.runPromise(importPublicationBundle(secondBundle, database))
      assert.equal(replaced.status, 'activated')
      await assert.rejects(
        Effect.runPromise(importPublicationBundle(invalidBundle, database)),
        /PUBLICATION_BUNDLE_COUNT_MISMATCH/
      )
      await assert.rejects(
        Effect.runPromise(importPublicationBundle(collisionBundle, database)),
        /PUBLICATION_BUNDLE_REVISION_INVALID/
      )

      let reachedActivation!: () => void
      const activationReached = new Promise<void>(resolve => {
        reachedActivation = resolve
      })
      const interruptedFiber = Effect.runFork(
        importPublicationBundle(interruptedBundle, database, {
          beforeActivation: signal =>
            new Promise((_, reject) => {
              reachedActivation()
              signal.addEventListener(
                'abort',
                () => reject(signal.reason ?? new Error('PUBLICATION_IMPORT_INTERRUPTED')),
                { once: true }
              )
            }),
        })
      )
      await activationReached
      await Effect.runPromise(Fiber.interrupt(interruptedFiber))

      const active = await database
        .selectFrom('resource_publications')
        .innerJoin('bible_verses', 'bible_verses.publication_id', 'resource_publications.id')
        .select([
          'resource_publications.revision',
          'resource_publications.status',
          'bible_verses.text',
        ])
        .where('resource_publications.resource_identity', '=', identity)
        .execute()

      assert.deepEqual(active, [
        {
          revision: secondPublication.publicationRevision,
          status: 'active',
          text: 'Second',
        },
      ])
    } finally {
      await database
        .deleteFrom('resource_publications')
        .where('resource_identity', '=', identity)
        .execute()
      await database.destroy()
      await Promise.all(
        [firstBundle, secondBundle, invalidBundle, interruptedBundle, collisionBundle].map(
          directory => rm(directory, { recursive: true, force: true })
        )
      )
    }
  })

  it('keeps an Offline-only publication unavailable to Online chapter reads', async () => {
    const versionId = `OFFLINE-${randomUUID()}`
    const identity = `bible-text:${versionId}`
    const bundle = await mkdtemp(path.join(tmpdir(), 'publication-offline-only-'))
    const database = makeLocalDatabase({ connectionString, maxConnections: 1 })

    try {
      await writeBundle({
        root: bundle,
        versionId,
        text: 'Offline only',
        onlineAccess: false,
      })

      const imported = await Effect.runPromise(importPublicationBundle(bundle, database))
      assert.equal(imported.status, 'staged')

      const repository = makeKyselyBibleChapterRepository(database)
      await assert.rejects(
        Effect.runPromise(repository.findActiveChapter({ versionId, book: 1, chapter: 1 })),
        /ActiveBiblePublicationUnavailable/
      )
    } finally {
      await database
        .deleteFrom('resource_publications')
        .where('resource_identity', '=', identity)
        .execute()
      await database.destroy()
      await rm(bundle, { recursive: true, force: true })
    }
  })

  it('activates a rights-restricted publication only for explicit local development', async () => {
    const versionId = `LOCAL-${randomUUID()}`
    const identity = `bible-text:${versionId}`
    const bundle = await mkdtemp(path.join(tmpdir(), 'publication-local-development-'))
    const database = makeLocalDatabase({ connectionString, maxConnections: 1 })

    try {
      await writeBundle({
        root: bundle,
        versionId,
        text: 'Local development only',
        onlineAccess: false,
        localDevelopmentAccess: true,
      })

      const staged = await Effect.runPromise(importPublicationBundle(bundle, database))
      assert.equal(staged.status, 'staged')

      const activated = await Effect.runPromise(
        importPublicationBundle(bundle, database, { activateForLocalDevelopment: true })
      )
      assert.equal(activated.status, 'activated')

      const repository = makeKyselyBibleChapterRepository(database)
      const chapter = await Effect.runPromise(
        repository.findActiveChapter({ versionId, book: 1, chapter: 1 })
      )
      assert.equal(chapter.verses[0]?.text, 'Local development only')
    } finally {
      await database
        .deleteFrom('resource_publications')
        .where('resource_identity', '=', identity)
        .execute()
      await database.destroy()
      await rm(bundle, { recursive: true, force: true })
    }
  })
})
