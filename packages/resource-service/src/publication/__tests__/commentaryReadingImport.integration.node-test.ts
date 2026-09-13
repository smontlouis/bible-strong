import assert from 'node:assert/strict'
import { createHash, randomUUID } from 'node:crypto'
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { Effect } from 'effect'
import { zipSync } from 'fflate'
import initSqlJs from 'sql.js'
import { makeLocalDatabase } from '../../database/localDatabase'
import { importPublicationBundle } from '../../repositories/publicationImporter'
import { makeKyselySupplementaryRepository } from '../../repositories/supplementaryRepository'
import { makeResourceWebHandler } from '../../http/app'
import {
  CommentaryReadingIndexResponse,
  CommentaryReadingSectionResponse,
} from '@bible-strong/resource-domain/contracts/commentaryReadingContract'
import { Schema } from 'effect'
import type { CommentaryPublicationBundleManifest } from '../publicationBundle'

const sha256 = (value: string | Uint8Array) => createHash('sha256').update(value).digest('hex')

async function writeFixture(
  root: string,
  resourceId: string,
  revision: string,
  normalized: boolean,
  corrupt = false
) {
  const content = `<p>${revision} complete commentary.</p>`
  const excerpt = `${revision} complete commentary.`
  const sectionId = `${resourceId}-fr-1-1-1-2`
  const canonical = JSON.stringify({
    format: 'bible-strong-canonical-commentary',
    schemaVersion: normalized ? 2 : 1,
    resourceId,
    language: 'fr',
    revision,
    sourceVersion: 'fixture',
    sourceSha256: 'a'.repeat(64),
    readingIndexVersion: 2,
    ...(normalized ? { documents: [{ id: 'document', content }] } : {}),
    verses: [1, 2].map(verse => ({
      verseKey: `1-1-${verse}`,
      ...(normalized ? { documentIds: ['document'] } : { content }),
    })),
  })
  const SQL = await initSqlJs()
  const db = new SQL.Database()
  let sqlite: Uint8Array
  try {
    db.run(`CREATE TABLE RESOURCE_METADATA(resource_id TEXT, language TEXT, revision TEXT, source_version TEXT, source_sha256 TEXT);
      CREATE TABLE COMMENTARY_READING_SECTIONS(id TEXT PRIMARY KEY, book INTEGER, chapter INTEGER, range_start_verse INTEGER, range_end_verse INTEGER, excerpt TEXT, content TEXT);`)
    db.run('INSERT INTO RESOURCE_METADATA VALUES (?, ?, ?, ?, ?)', [
      resourceId,
      'fr',
      revision,
      'fixture',
      'a'.repeat(64),
    ])
    db.run('INSERT INTO COMMENTARY_READING_SECTIONS VALUES (?, ?, ?, ?, ?, ?, ?)', [
      sectionId,
      1,
      1,
      1,
      2,
      corrupt ? 'Corrupted excerpt' : excerpt,
      content,
    ])
    if (normalized) {
      db.run(`CREATE TABLE COMMENTARY_DOCUMENTS(id TEXT PRIMARY KEY, content TEXT);
        CREATE TABLE COMMENTARY_VERSE_DOCUMENTS(verse_key TEXT, ordinal INTEGER, document_id TEXT);`)
      db.run('INSERT INTO COMMENTARY_DOCUMENTS VALUES (?, ?)', ['document', content])
      for (const verse of [1, 2])
        db.run('INSERT INTO COMMENTARY_VERSE_DOCUMENTS VALUES (?, ?, ?)', [
          `1-1-${verse}`,
          0,
          'document',
        ])
    } else {
      db.run('CREATE TABLE COMMENTAIRES(id TEXT, commentaires TEXT)')
      db.run('INSERT INTO COMMENTAIRES VALUES (?, ?)', [
        '1-1',
        JSON.stringify({ 1: content, 2: content }),
      ])
    }
    sqlite = db.export()
  } finally {
    db.close()
  }
  const entry = `commentary-${resourceId}-fr.sqlite`
  const archive = zipSync({ [entry]: sqlite })
  const manifest: CommentaryPublicationBundleManifest = {
    format: 'bible-strong-resource-publication',
    schemaVersion: 1,
    identity: { kind: 'commentary', resourceId, language: 'fr' },
    revision,
    canonical: {
      path: 'canonical/commentary.json',
      mediaType: 'application/json',
      schemaVersion: normalized ? 2 : 1,
      sha256: sha256(canonical),
      bytes: Buffer.byteLength(canonical),
    },
    offlineArtifact: {
      path: 'offline/commentary.zip',
      mediaType: 'application/zip',
      entry,
      sha256: sha256(archive),
      bytes: archive.length,
      contentSha256: sha256(sqlite),
    },
    provenance: {
      generator: 'bible-lexicon-maker',
      sourceVersion: 'fixture',
      sourceSha256: 'a'.repeat(64),
      generatedAt: new Date(0).toISOString(),
    },
    rights: {
      holder: 'fixture',
      termsReference: 'fixture',
      attribution: 'fixture',
      online: true,
      offline: true,
    },
    deliveryCapabilities: { onlineAccess: true, offlineDownload: true },
    counts: { chapters: 1, verses: 2, characters: content.length * 2 },
  }
  await mkdir(path.join(root, 'canonical'), { recursive: true })
  await mkdir(path.join(root, 'offline'), { recursive: true })
  await writeFile(path.join(root, 'canonical/commentary.json'), canonical)
  await writeFile(path.join(root, 'offline/commentary.zip'), archive)
  await writeFile(path.join(root, 'manifest.json'), JSON.stringify(manifest))
  return { sectionId, content, excerpt }
}

for (const normalized of [false, true]) {
  test(
    `imports ${normalized ? 'normalized' : 'legacy'} commentary bundle through index and section HTTP reads`,
    { skip: process.env.RESOURCE_INTEGRATION !== '1' },
    async () => {
      const root = await mkdtemp(path.join(tmpdir(), 'commentary-reading-import-'))
      const resourceId = `fixture-${randomUUID()}`
      const database = makeLocalDatabase({
        connectionString:
          process.env.RESOURCE_DATABASE_URL ??
          'postgresql://bible_strong:bible_strong@127.0.0.1:54329/bible_strong',
      })
      const app = makeResourceWebHandler(undefined, undefined, {
        supplementary: makeKyselySupplementaryRepository(database),
      })
      const post = (endpoint: string, body: unknown) =>
        app.handler(
          new Request(`http://localhost/v1/commentaries/${endpoint}`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(body),
          })
        )
      const indexRequest = { book: 1, chapter: 1, resources: [{ resourceId, language: 'fr' }] }
      try {
        const first = await writeFixture(path.join(root, 'first'), resourceId, 'first', normalized)
        assert.equal(
          (await Effect.runPromise(importPublicationBundle(path.join(root, 'first'), database)))
            .status,
          'activated'
        )
        assert.equal(
          (await Effect.runPromise(importPublicationBundle(path.join(root, 'first'), database)))
            .status,
          'unchanged'
        )
        const indexResponse = await post('reading-index', indexRequest)
        assert.equal(indexResponse.status, 200)
        const index = Schema.decodeUnknownSync(CommentaryReadingIndexResponse)(
          await indexResponse.json()
        )
        assert.equal(index.indexes[0]?.sections.length, 1)
        assert.equal(index.indexes[0]?.sections[0]?.excerpt, first.excerpt)
        assert.ok(!JSON.stringify(index).includes('<p>'))
        const sectionRequest = {
          resourceId,
          language: 'fr',
          revision: index.indexes[0]!.resource.revision,
          book: 1,
          chapter: 1,
          sectionId: first.sectionId,
        }
        const response = await post('reading-section', sectionRequest)
        assert.equal(response.status, 200)
        assert.equal(
          Schema.decodeUnknownSync(CommentaryReadingSectionResponse)(await response.json()).section
            .content,
          first.content
        )
        await writeFixture(path.join(root, 'invalid'), resourceId, 'invalid', normalized, true)
        await assert.rejects(
          Effect.runPromise(importPublicationBundle(path.join(root, 'invalid'), database))
        )
        assert.equal((await post('reading-section', sectionRequest)).status, 200)
        await writeFixture(path.join(root, 'second'), resourceId, 'second', normalized)
        await Effect.runPromise(importPublicationBundle(path.join(root, 'second'), database))
        assert.equal((await post('reading-section', sectionRequest)).status, 404)
        const refreshed = Schema.decodeUnknownSync(CommentaryReadingIndexResponse)(
          await (await post('reading-index', indexRequest)).json()
        )
        assert.equal(refreshed.indexes[0]?.resource.revision, 'second')
      } finally {
        await app.dispose()
        await database
          .deleteFrom('resource_publications')
          .where('resource_identity', '=', `commentary:${resourceId}:fr`)
          .execute()
        await database.destroy()
        await rm(root, { recursive: true, force: true })
      }
    }
  )
}
