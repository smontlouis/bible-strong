import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { test } from 'node:test'
import { Effect } from 'effect'
import { makeLocalDatabase } from '../../database/localDatabase'
import { makeKyselySupplementaryRepository } from '../supplementaryRepository'
import { backfillCommentaryReadingIndex } from '../commentaryReadingBackfill'

test(
  'Postgres reading index excludes bodies and section lookup binds chapter, revision and publication state',
  {
    skip: process.env.RESOURCE_INTEGRATION !== '1',
  },
  async () => {
    const database = makeLocalDatabase({
      connectionString:
        process.env.RESOURCE_DATABASE_URL ??
        'postgresql://bible_strong:bible_strong@127.0.0.1:54329/bible_strong',
    })
    const resourceId = `reading-${randomUUID()}`
    const identity = `commentary:${resourceId}:fr`
    try {
      for (const revision of ['active', 'previous', 'unpublished']) {
        const publication = await database
          .insertInto('resource_publications')
          .values({
            resource_identity: identity,
            resource_kind: 'commentary',
            language: 'fr',
            revision,
            status: revision === 'active' ? 'active' : 'staged',
            canonical_sha256: 'a'.repeat(64),
            offline_artifact_sha256: 'b'.repeat(64),
            metadata: {},
            provenance: { source: 'fixture', imported_at: new Date().toISOString() },
            rights: { holder: 'fixture', online: true, offline: true },
            activated_at: revision === 'unpublished' ? null : new Date(),
          })
          .returning('id')
          .executeTakeFirstOrThrow()
        await database
          .insertInto('commentary_reading_sections')
          .values({
            publication_id: publication.id,
            id: 'section',
            book: 1,
            chapter: 1,
            range_start_verse: 1,
            range_end_verse: 2,
            excerpt: `${revision} preview`,
            content: `<p>${revision} complete content</p>`,
          })
          .execute()
        if (revision === 'active') {
          await database
            .insertInto('commentary_verses')
            .values(
              [1, 2].map(verse => ({
                publication_id: publication.id,
                verse_key: `1-1-${verse}`,
                content: '<p>active complete content</p>',
              }))
            )
            .execute()
        }
      }
      const repository = makeKyselySupplementaryRepository(database)
      const index = await Effect.runPromise(
        repository.findCommentaryReadingIndex({
          collection: resourceId,
          language: 'fr',
          book: 1,
          chapter: 1,
        })
      )
      assert.deepEqual(index, {
        revision: 'active',
        sections: [
          { id: 'section', rangeStartVerse: 1, rangeEndVerse: 2, excerpt: 'active preview' },
        ],
      })
      const empty = await Effect.runPromise(
        repository.findCommentaryReadingIndex({
          collection: resourceId,
          language: 'fr',
          book: 1,
          chapter: 2,
        })
      )
      assert.deepEqual(empty.sections, [])
      const request = {
        resourceId,
        language: 'fr' as const,
        revision: 'previous',
        book: 1,
        chapter: 1,
        sectionId: 'section',
      }
      const previous = await Effect.runPromise(repository.findCommentaryReadingSection(request))
      assert.equal(previous.revision, 'previous')
      assert.equal(previous.section.content, '<p>previous complete content</p>')
      for (const invalid of [
        { ...request, revision: 'unpublished' },
        { ...request, revision: 'missing' },
        { ...request, chapter: 2 },
        { ...request, sectionId: 'missing' },
      ]) {
        const result = await Effect.runPromise(
          Effect.either(repository.findCommentaryReadingSection(invalid))
        )
        assert.equal(result._tag, 'Left')
        if (result._tag === 'Left') assert.equal(result.left._tag, 'SupplementaryContentNotFound')
      }
      const active = await database
        .selectFrom('resource_publications')
        .selectAll()
        .where('resource_identity', '=', identity)
        .where('status', '=', 'active')
        .executeTakeFirstOrThrow()
      await database
        .deleteFrom('commentary_reading_sections')
        .where('publication_id', '=', active.id)
        .execute()
      const preview = await backfillCommentaryReadingIndex(database, {
        resourceId,
        language: 'fr',
        apply: false,
      })
      assert.equal(preview.sections, 1)
      assert.equal(preview.applied, false)
      assert.deepEqual(
        await database
          .selectFrom('commentary_reading_sections')
          .select('id')
          .where('publication_id', '=', active.id)
          .execute(),
        []
      )
      const firstBuild = await backfillCommentaryReadingIndex(database, {
        resourceId,
        language: 'fr',
        apply: true,
      })
      assert.equal(firstBuild.revision, 'active')
      assert.deepEqual(
        await backfillCommentaryReadingIndex(database, { resourceId, language: 'fr', apply: true }),
        firstBuild
      )
      assert.deepEqual(
        await database
          .selectFrom('resource_publications')
          .selectAll()
          .where('id', '=', active.id)
          .executeTakeFirstOrThrow(),
        active
      )
      const rebuilt = await Effect.runPromise(
        repository.findCommentaryReadingIndex({
          collection: resourceId,
          language: 'fr',
          book: 1,
          chapter: 1,
        })
      )
      assert.equal(rebuilt.sections[0]?.id, `${resourceId}-fr-1-1-1-2`)
      assert.equal(rebuilt.sections[0]?.excerpt, 'active complete content')
    } finally {
      await database
        .deleteFrom('resource_publications')
        .where('resource_identity', '=', identity)
        .execute()
      await database.destroy()
    }
  }
)
