import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, it } from 'node:test'

import { Effect } from 'effect'
import { zipSync } from 'fflate'

import { makeLocalDatabase } from '../../database/localDatabase'
import { makeResourceWebHandler } from '../../http/app'
import { importPublicationBundle } from '../../repositories/publicationImporter'
import { makeKyselyNaveRepository } from '../../repositories/naveRepository'
import type { CanonicalNavePublication, NavePublicationBundleManifest } from '../publicationBundle'
import { makeNaveSqliteFixture } from './naveSqliteFixture'

const runIntegration = process.env.RESOURCE_INTEGRATION === '1'
const connectionString =
  process.env.RESOURCE_DATABASE_URL ??
  'postgresql://bible_strong:bible_strong@127.0.0.1:54329/bible_strong'
const sha256 = (value: string | Buffer | Uint8Array) =>
  createHash('sha256').update(value).digest('hex')

const writeNaveBundle = async (root: string, revision: string, topicName: string) => {
  const sourceSha256 = '2'.repeat(64)
  const canonicalValue: CanonicalNavePublication = {
    format: 'bible-strong-canonical-nave',
    schemaVersion: 1,
    resourceId: 'NAVE_FR',
    revision,
    sourceVersion: 'integration-source',
    sourceSha256,
    topics: [
      {
        normalizedName: 'amour',
        name: topicName,
        initial: 'a',
        description: `<p>${topicName}</p>`,
      },
    ],
    verseAnchors: [{ verseKey: '43-3-16', topicNormalizedNames: ['amour'] }],
  }
  const canonical = `${JSON.stringify(canonicalValue)}\n`
  const offlineContent = await makeNaveSqliteFixture(canonicalValue)
  const offline = Buffer.from(zipSync({ 'nave-fr.sqlite': offlineContent }))
  await mkdir(path.join(root, 'canonical'), { recursive: true })
  await mkdir(path.join(root, 'offline'), { recursive: true })
  await writeFile(path.join(root, 'canonical/nave-fr.json'), canonical)
  await writeFile(path.join(root, 'offline/nave-fr.sqlite.zip'), offline)
  const manifest: NavePublicationBundleManifest = {
    format: 'bible-strong-resource-publication',
    schemaVersion: 1,
    identity: { kind: 'nave', resourceId: 'NAVE_FR', language: 'fr' },
    revision,
    canonical: {
      path: 'canonical/nave-fr.json',
      mediaType: 'application/json',
      schemaVersion: 1,
      sha256: sha256(canonical),
      bytes: Buffer.byteLength(canonical),
    },
    offlineArtifact: {
      path: 'offline/nave-fr.sqlite.zip',
      mediaType: 'application/zip',
      entry: 'nave-fr.sqlite',
      sha256: sha256(offline),
      bytes: offline.byteLength,
      contentSha256: sha256(offlineContent),
    },
    provenance: {
      generator: 'bible-lexicon-maker',
      sourceVersion: 'integration-source',
      sourceSha256,
      generatedAt: new Date(0).toISOString(),
    },
    rights: {
      holder: 'integration-test',
      termsReference: 'integration-test',
      attribution: 'integration-test',
      online: true,
      offline: true,
    },
    deliveryCapabilities: { onlineAccess: true, offlineDownload: true },
    alphabeticalBrowse: { initials: ['a'], topicCountByInitial: { a: 1 } },
    counts: { topics: 1, verseAnchors: 1, topicReferences: 1 },
  }
  await writeFile(path.join(root, 'manifest.json'), `${JSON.stringify(manifest)}\n`)
}

describe('Atomic NAVE_FR publication import', { skip: !runIntegration }, () => {
  it('activates domain rows and replaces the prior revision atomically', async () => {
    const firstBundle = await mkdtemp(path.join(tmpdir(), 'nave-publication-first-'))
    const secondBundle = await mkdtemp(path.join(tmpdir(), 'nave-publication-second-'))
    const database = makeLocalDatabase({ connectionString, maxConnections: 1 })

    try {
      await writeNaveBundle(firstBundle, 'nave-fr-revision-1', 'Amour')
      await writeNaveBundle(secondBundle, 'nave-fr-revision-2', 'Amour renouvelé')

      const first = await Effect.runPromise(importPublicationBundle(firstBundle, database))
      assert.deepEqual(first, {
        status: 'activated',
        resourceIdentity: 'nave:fr',
        revision: 'nave-fr-revision-1',
        itemCount: 1,
      })
      const second = await Effect.runPromise(importPublicationBundle(secondBundle, database))
      assert.equal(second.status, 'activated')

      const rows = await database
        .selectFrom('resource_publications')
        .innerJoin('nave_topics', 'nave_topics.publication_id', 'resource_publications.id')
        .innerJoin('nave_verse_links', join =>
          join
            .onRef('nave_verse_links.publication_id', '=', 'resource_publications.id')
            .onRef('nave_verse_links.normalized_name', '=', 'nave_topics.normalized_name')
        )
        .select([
          'resource_publications.revision',
          'resource_publications.status',
          'resource_publications.provenance',
          'nave_topics.name',
          'nave_verse_links.verse_key',
        ])
        .where('resource_publications.resource_identity', '=', 'nave:fr')
        .execute()

      assert.deepEqual(rows, [
        {
          revision: 'nave-fr-revision-2',
          status: 'active',
          provenance: {
            generator: 'bible-lexicon-maker',
            source: 'integration-source',
            source_version: 'integration-source',
            source_sha256: '2'.repeat(64),
            generated_at: new Date(0).toISOString(),
            attribution: 'integration-test',
            imported_at: rows[0]?.provenance.imported_at,
          },
          name: 'Amour renouvelé',
          verse_key: '43-3-16',
        },
      ])

      const repository = makeKyselyNaveRepository(database)
      const detail = await Effect.runPromise(
        repository.findTopic({ language: 'fr', normalizedName: 'amour' })
      )
      assert.equal(detail.topic.description, '<p>Amour renouvelé</p>')
      const browse = await Effect.runPromise(
        repository.listTopics({ language: 'fr', initial: 'a' })
      )
      assert.deepEqual(
        browse.topics.map(topic => topic.normalizedName),
        ['amour']
      )
      const search = await Effect.runPromise(
        repository.listTopics({ language: 'fr', search: 'renouvelé' })
      )
      assert.deepEqual(
        search.topics.map(topic => topic.normalizedName),
        ['amour']
      )
      const verseTopics = await Effect.runPromise(
        repository.findVerseTopics({ language: 'fr', verseKey: '43-3-16' })
      )
      assert.deepEqual(
        verseTopics.verseTopics.map(topic => topic.normalizedName),
        ['amour']
      )
      assert.equal(
        (await Effect.runPromise(repository.findRandomTopic('fr'))).topic.normalizedName,
        'amour'
      )

      const web = makeResourceWebHandler(undefined, repository)
      try {
        const response = await web.handler(
          new Request('http://localhost/v1/naves/fr/verses/43-3-16/topics')
        )
        assert.equal(response.status, 200)
        assert.deepEqual(await response.json(), {
          resource: { kind: 'nave', language: 'fr', revision: 'nave-fr-revision-2' },
          verseKey: '43-3-16',
          verseTopics: [{ normalizedName: 'amour', name: 'Amour renouvelé' }],
          chapterTopics: [],
        })
      } finally {
        await web.dispose()
      }
    } finally {
      await database
        .deleteFrom('resource_publications')
        .where('resource_identity', '=', 'nave:fr')
        .execute()
      await database.destroy()
      await Promise.all(
        [firstBundle, secondBundle].map(directory =>
          rm(directory, { recursive: true, force: true })
        )
      )
    }
  })
})
