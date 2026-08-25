import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import { describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'

import { Effect } from 'effect'
import { Pool } from 'pg'

import { getMobileBibleVersionIds } from '@bible-strong/mobile/src/helpers/mobileResourceCatalog'
import { makeLocalDatabase } from '../../database/localDatabase'
import { makeResourceWebHandler } from '../../http/app'
import { makeKyselyBibleChapterRepository } from '../../repositories/bibleChapterRepository'
import { importPublicationBundle } from '../../repositories/publicationImporter'
import {
  isBiblePublicationBundleManifest,
  validatePublicationBundle,
  type BiblePublicationBundleManifest,
  type CanonicalBiblePublication,
} from '../publicationBundle'

const root = process.env.RESOURCE_BIBLE_BUNDLES_ROOT
const runIntegration = process.env.RESOURCE_INTEGRATION === '1' && Boolean(root)
const connectionString =
  process.env.RESOURCE_DATABASE_URL ??
  'postgresql://bible_strong:bible_strong@127.0.0.1:54329/bible_strong'
const migrationDirectory = fileURLToPath(new URL('../../../drizzle', import.meta.url))

const createIsolatedDatabase = async () => {
  const databaseName = `bible_strong_issue_302_${randomUUID().replaceAll('-', '')}`
  const databaseUrl = new URL(connectionString)
  databaseUrl.pathname = `/${databaseName}`
  const admin = new Pool({ connectionString, max: 1 })
  await admin.query(`CREATE DATABASE "${databaseName}"`)

  try {
    const migrations = new Pool({ connectionString: databaseUrl.toString(), max: 1 })
    try {
      const migrationFiles = (await readdir(migrationDirectory))
        .filter(file => file.endsWith('.sql'))
        .sort()
      for (const migrationFile of migrationFiles) {
        const sql = await readFile(path.join(migrationDirectory, migrationFile), 'utf8')
        for (const statement of sql.split('--> statement-breakpoint')) {
          if (statement.trim()) await migrations.query(statement)
        }
      }
    } finally {
      await migrations.end()
    }
  } catch (error) {
    await admin.query(`DROP DATABASE "${databaseName}" WITH (FORCE)`)
    await admin.end()
    throw error
  }

  const database = makeLocalDatabase({
    connectionString: databaseUrl.toString(),
    maxConnections: 4,
  })
  return {
    database,
    dispose: async () => {
      await database.destroy()
      await admin.query(`DROP DATABASE "${databaseName}" WITH (FORCE)`)
      await admin.end()
    },
  }
}

describe('Complete ordinary Bible publications', { skip: !runIntegration }, () => {
  it('validates, activates, imports, and serves all 47 current mobile identities', async () => {
    const publicationRoot = path.resolve(root!)
    const bundlePaths = (await readdir(publicationRoot, { withFileTypes: true }))
      .filter(entry => entry.isDirectory())
      .map(entry => path.join(publicationRoot, entry.name))
      .sort()
    const expectedVersions = getMobileBibleVersionIds()
    const isolated = await createIsolatedDatabase()
    const { database } = isolated

    try {
      const validated: {
        bundlePath: string
        manifest: BiblePublicationBundleManifest
        canonical: CanonicalBiblePublication
      }[] = []
      for (const bundlePath of bundlePaths) {
        const publication = await validatePublicationBundle(bundlePath)
        assert.ok(isBiblePublicationBundleManifest(publication.manifest))
        assert.equal(publication.canonical.format, 'bible-strong-canonical-bible')
        if (
          !isBiblePublicationBundleManifest(publication.manifest) ||
          publication.canonical.format !== 'bible-strong-canonical-bible'
        ) {
          assert.fail('Expected an ordinary Bible publication')
        }
        validated.push({
          bundlePath,
          manifest: publication.manifest,
          canonical: publication.canonical,
        })
        assert.ok(publication.manifest.publicationRevision)
        assert.notEqual(publication.manifest.publicationRevision, publication.manifest.revision)
      }
      assert.equal(validated.length, 47)
      assert.deepEqual(
        validated.map(item => item.manifest.identity.versionId).sort(),
        [...expectedVersions].sort()
      )

      for (const publication of validated) {
        const result = await Effect.runPromise(
          importPublicationBundle(publication.bundlePath, database, {
            activateForLocalDevelopment: true,
          })
        )
        assert.ok(result.status === 'activated' || result.status === 'unchanged')
      }

      const repository = makeKyselyBibleChapterRepository(database)
      const web = makeResourceWebHandler(repository)
      try {
        for (const publication of validated) {
          const versionId = publication.manifest.identity.versionId
          const coverage = await Effect.runPromise(repository.findActiveCoverage(versionId))
          assert.deepEqual(coverage.chaptersByBook, publication.manifest.coverage.chaptersByBook)
          assert.deepEqual(coverage.canon, publication.manifest.canon)
          assert.equal(coverage.versification, publication.manifest.versification)
          assert.equal(coverage.revision, publication.manifest.revision)
          assert.equal(coverage.textRevision, publication.manifest.revision)
          assert.deepEqual(
            coverage.books,
            publication.manifest.canon.orderedBooks.filter(
              book => publication.manifest.coverage.chaptersByBook[String(book)] !== undefined
            )
          )

          const firstBook = coverage.books[0]!
          const firstChapter = coverage.chaptersByBook[String(firstBook)]![0]!
          const response = await web.handler(
            new Request(
              `http://localhost/v1/bibles/${versionId}/books/${firstBook}/chapters/${firstChapter}`
            )
          )
          assert.equal(response.status, 200)
          const payload = (await response.json()) as {
            book: number
            chapter: number
            verses: { number: number; text: string; presentation: unknown }[]
          }
          const expectedVerses = Object.entries(
            publication.canonical.verses[String(firstBook)]![String(firstChapter)]!
          )
            .map(([number, verse]) => ({
              number: Number(number),
              text: verse.text,
              presentation: {
                startTags: verse.startTags,
                layout: verse.layout,
                notes: verse.notes,
                headings: verse.headings,
              },
            }))
            .sort((left, right) => left.number - right.number)
          assert.equal(payload.book, firstBook)
          assert.equal(payload.chapter, firstChapter)
          assert.deepEqual(payload.verses, expectedVerses)
          assert.equal(
            payload.verses.length,
            publication.manifest.coverage.verseCountByBookChapter[`${firstBook}-${firstChapter}`]
          )
          const pericopeResponse = await web.handler(
            new Request(`http://localhost/v1/bibles/${versionId}/pericopes`)
          )
          assert.equal(pericopeResponse.status, 200)
          const pericopes = (await pericopeResponse.json()) as { verses: unknown[] }
          assert.equal(pericopes.verses.length > 0, publication.manifest.counts.headings > 0)

          const storedCount = await database
            .selectFrom('resource_publications')
            .innerJoin('bible_verses', 'bible_verses.publication_id', 'resource_publications.id')
            .select(expression => expression.fn.countAll().as('count'))
            .where('resource_publications.resource_identity', '=', `bible-text:${versionId}`)
            .where('resource_publications.status', '=', 'active')
            .executeTakeFirstOrThrow()
          assert.equal(Number(storedCount.count), publication.manifest.counts.verses)
        }
      } finally {
        await web.dispose()
      }
    } finally {
      await isolated.dispose()
    }
  })
})
