import assert from 'node:assert/strict'
import { createHash, randomUUID } from 'node:crypto'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, it } from 'node:test'

import { Effect, Fiber } from 'effect'
import { strToU8, zipSync } from 'fflate'

import { makeLocalDatabase } from '../../database/localDatabase'
import { importPublicationBundle } from '../../repositories/publicationImporter'
import type { PublicationBundleManifest } from '../publicationBundle'

const runIntegration = process.env.RESOURCE_INTEGRATION === '1'
const connectionString =
  process.env.RESOURCE_DATABASE_URL ??
  'postgresql://bible_strong:bible_strong@127.0.0.1:54329/bible_strong'
const sha256 = (value: string | Buffer) => createHash('sha256').update(value).digest('hex')

const writeBundle = async ({
  root,
  versionId,
  revision,
  text,
  countOverride,
  rightsHolder = 'integration-test',
}: {
  root: string
  versionId: string
  revision: string
  text: string
  countOverride?: number
  rightsHolder?: string
}) => {
  const sourceSha256 = '2'.repeat(64)
  const canonical = `${JSON.stringify({
    format: 'bible-strong-canonical-bible',
    schemaVersion: 4,
    applicationVersionId: versionId,
    textRevision: revision,
    textSha256: sha256(text),
    sourceVersion: 'integration-source',
    sourceSha256,
    verseCount: 1,
    noteCount: 0,
    headingCount: 0,
    verses: {
      1: { 1: { 1: { text, startTags: [], layout: [], notes: [], headings: [] } } },
    },
  })}\n`
  const offline = Buffer.from(zipSync({ 'bible.json': strToU8(canonical) }))
  await mkdir(path.join(root, 'canonical'), { recursive: true })
  await mkdir(path.join(root, 'offline'), { recursive: true })
  await writeFile(path.join(root, 'canonical/bible.json'), canonical)
  await writeFile(path.join(root, 'offline/bible.zip'), offline)

  const manifest: PublicationBundleManifest = {
    format: 'bible-strong-resource-publication',
    schemaVersion: 1,
    identity: { kind: 'bible-text', versionId, language: 'fr' },
    revision,
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
      online: true,
      offline: true,
    },
    deliveryCapabilities: { onlineAccess: true, offlineDownload: true },
    canon: { id: 'integration', orderedBooks: [1] },
    versification: 'integration',
    coverage: { chaptersByBook: { 1: [1] }, verseCountByBookChapter: { '1-1': 1 } },
    counts: { books: 1, chapters: 1, verses: countOverride ?? 1, notes: 0, headings: 0 },
  }
  await writeFile(path.join(root, 'manifest.json'), `${JSON.stringify(manifest)}\n`)
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
      await writeBundle({ root: firstBundle, versionId, revision: 'revision-1', text: 'First' })
      await writeBundle({ root: secondBundle, versionId, revision: 'revision-2', text: 'Second' })
      await writeBundle({
        root: invalidBundle,
        versionId,
        revision: 'revision-3',
        text: 'Invalid',
        countOverride: 2,
      })
      await writeBundle({
        root: interruptedBundle,
        versionId,
        revision: 'revision-interrupted',
        text: 'Must never activate',
      })
      await writeBundle({
        root: collisionBundle,
        versionId,
        revision: 'revision-2',
        text: 'Revision collision',
      })

      await assert.doesNotReject(
        Effect.runPromise(importPublicationBundle(firstBundle, database)).then(result => {
          assert.equal(result.status, 'activated')
        })
      )
      await writeBundle({
        root: firstBundle,
        versionId,
        revision: 'revision-1',
        text: 'First',
        rightsHolder: 'attempted-mutation',
      })
      const unchanged = await Effect.runPromise(importPublicationBundle(firstBundle, database))
      assert.equal(unchanged.status, 'unchanged')
      const unchangedPublication = await database
        .selectFrom('resource_publications')
        .select('rights')
        .where('resource_identity', '=', identity)
        .where('revision', '=', 'revision-1')
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
        /PUBLICATION_REVISION_COLLISION/
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

      assert.deepEqual(active, [{ revision: 'revision-2', status: 'active', text: 'Second' }])
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
})
