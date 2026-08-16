import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { Effect } from 'effect'

import { createIsolatedPostgres } from '../../database/__tests__/isolatedPostgresTestSupport'
import { isBiblePublicationBundleManifest, validatePublicationBundle } from '../publicationBundle'
import { importPublicationBundle } from '../../repositories/publicationImporter'

const bundlePath = process.env.RESOURCE_LSG_BUNDLE
const connectionString =
  process.env.RESOURCE_DATABASE_URL ??
  'postgresql://bible_strong:bible_strong@127.0.0.1:54329/bible_strong'

describe('Complete LSG publication', { skip: !bundlePath }, () => {
  it('preserves every declared book, chapter, verse, and presentation value', async () => {
    const isolated = await createIsolatedPostgres(connectionString, 'lsg_publication')
    const { database } = isolated

    try {
      const validated = await validatePublicationBundle(bundlePath!)
      assert.equal(validated.manifest.identity.kind, 'bible-text')
      assert.equal(validated.canonical.format, 'bible-strong-canonical-bible')
      if (
        !isBiblePublicationBundleManifest(validated.manifest) ||
        validated.canonical.format !== 'bible-strong-canonical-bible'
      ) {
        assert.fail('Expected the LSG Bible publication')
      }
      const imported = await Effect.runPromise(importPublicationBundle(bundlePath!, database))
      assert.match(imported.status, /activated|unchanged/)

      const publication = await database
        .selectFrom('resource_publications')
        .select(['id', 'revision', 'language', 'status', 'metadata'])
        .where('resource_identity', '=', 'bible-text:LSG')
        .where('status', '=', 'active')
        .executeTakeFirstOrThrow()
      assert.equal(
        publication.revision,
        validated.manifest.publicationRevision ?? validated.manifest.revision
      )
      assert.equal(publication.language, 'fr')
      const { manifest_sha256: manifestSha256, ...publicationMetadata } = publication.metadata
      assert.match(String(manifestSha256), /^[a-f0-9]{64}$/)
      assert.deepEqual(publicationMetadata, {
        canon: validated.manifest.canon,
        versification: validated.manifest.versification,
        coverage: validated.manifest.coverage,
        delivery_capabilities: validated.manifest.deliveryCapabilities,
        counts: validated.manifest.counts,
        canonical_schema_version: 4,
        resource_revision: validated.manifest.revision,
        text_revision: validated.manifest.revision,
        offline_entry: validated.manifest.offlineArtifact.entry,
      })

      const rows = await database
        .selectFrom('bible_verses')
        .select(['book', 'chapter', 'verse', 'text', 'presentation'])
        .where('publication_id', '=', publication.id)
        .orderBy('book')
        .orderBy('chapter')
        .orderBy('verse')
        .execute()
      const expected = Object.entries(validated.canonical.verses).flatMap(([book, chapters]) =>
        Object.entries(chapters).flatMap(([chapter, verses]) =>
          Object.entries(verses).map(([verse, value]) => ({
            book: Number(book),
            chapter: Number(chapter),
            verse: Number(verse),
            text: value.text,
            presentation: {
              startTags: value.startTags,
              layout: value.layout,
              notes: value.notes,
              headings: value.headings,
            },
          }))
        )
      )

      assert.equal(rows.length, 31_171)
      assert.deepEqual(rows, expected)
    } finally {
      await isolated.dispose()
    }
  })
})
