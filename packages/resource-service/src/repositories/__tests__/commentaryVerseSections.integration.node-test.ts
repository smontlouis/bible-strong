import assert from 'node:assert/strict'
import { readdir, stat } from 'node:fs/promises'
import path from 'node:path'
import { describe, it } from 'node:test'

import {
  buildCommentaryChapterSections,
  closestCommentarySection,
} from '@bible-strong/resource-domain/commentary-chapter-sections'
import { Effect } from 'effect'
import type { Kysely } from 'kysely'

import { createIsolatedPostgres } from '../../database/__tests__/isolatedPostgresTestSupport'
import type { ResourceDatabase } from '../../database/types'
import { makeResourceWebHandler } from '../../http/app'
import { importPublicationBundle } from '../publicationImporter'
import { makeKyselySupplementaryRepository } from '../supplementaryRepository'

const runIntegration = process.env.RESOURCE_INTEGRATION === '1'
// A directory of commentary publication bundles, to compare real chapters.
const bundlesRoot = process.env.RESOURCE_COMMENTARY_BUNDLES_ROOT
const connectionString =
  process.env.RESOURCE_DATABASE_URL ??
  'postgresql://bible_strong:bible_strong@127.0.0.1:54329/bible_strong'

type Database = Kysely<ResourceDatabase>
type Language = 'fr' | 'en'

const insertCommentary = async (
  database: Database,
  collection: string,
  language: Language,
  status: 'active' | 'staged',
  comments: Record<string, string>
) => {
  const publication = await database
    .insertInto('resource_publications')
    .values({
      resource_identity: `commentary:${collection}:${language}`,
      resource_kind: 'commentary',
      language,
      revision: `${collection}-${language}-${status}`,
      status,
      canonical_sha256: '1'.repeat(64),
      offline_artifact_sha256: '2'.repeat(64),
      metadata: {},
      provenance: { source: 'integration-test', imported_at: new Date(0).toISOString() },
      rights: { holder: 'integration-test', online: true, offline: true },
    })
    .returning('id')
    .executeTakeFirstOrThrow()
  const rows = Object.entries(comments).map(([verse_key, content]) => ({
    publication_id: publication.id,
    verse_key,
    content,
  }))
  if (rows.length) await database.insertInto('commentary_verses').values(rows).execute()
}

type VerseSections = {
  sections: {
    resource: { resourceId: string; revision: string }
    slug: string
    startVerse: number
    endVerse: number
    content: string
  }[]
  unavailable: string[]
}

/**
 * What the public site computes today for a verse: it reads the whole chapter of each
 * commentary, builds its sections and keeps the closest one.
 */
const sectionsFromChapterReads = async (
  handler: (request: Request) => Promise<Response>,
  collections: readonly string[],
  language: Language,
  { book, chapter, verse }: { book: number; chapter: number; verse: number }
) => {
  const sections: VerseSections['sections'] = []
  for (const collection of collections) {
    const response = await handler(
      new Request(
        `http://localhost/v1/commentaries/${collection}/${language}/chapters/${book}/${chapter}`
      )
    )
    if (response.status !== 200) continue
    const payload = (await response.json()) as {
      resource: { resourceId: string; revision: string }
      serializedComments: string
    }
    const section = closestCommentarySection(
      buildCommentaryChapterSections(
        collection,
        JSON.parse(payload.serializedComments) as Record<string, string>
      ),
      verse
    )
    if (section) {
      sections.push({
        resource: { resourceId: collection, revision: payload.resource.revision },
        slug: section.slug,
        startVerse: section.startVerse,
        endVerse: section.endVerse,
        content: section.content,
      })
    }
  }
  return sections
}

const sectionsFromOneRead = async (
  handler: (request: Request) => Promise<Response>,
  collections: readonly string[],
  language: Language,
  { book, chapter, verse }: { book: number; chapter: number; verse: number }
) => {
  const response = await handler(
    new Request(
      `http://localhost/v1/commentaries/verses/${book}-${chapter}-${verse}/sections?language=${language}&commentaries=${collections.join(',')}`
    )
  )
  assert.equal(response.status, 200)
  const payload = (await response.json()) as VerseSections
  return {
    ...payload,
    sections: payload.sections.map(({ resource, ...section }) => ({
      resource: { resourceId: resource.resourceId, revision: resource.revision },
      ...section,
    })),
  }
}

describe('Commentary sections of a verse', { skip: !runIntegration }, () => {
  it('reads the chapter of every commentary in one statement', async () => {
    const isolated = await createIsolatedPostgres(connectionString, 'verse_sections', 1)
    const { database } = isolated
    let statements = 0
    const repository = makeKyselySupplementaryRepository(
      database.withPlugin({
        transformQuery(args) {
          statements += 1
          return args.node
        },
        async transformResult(args) {
          return args.result
        },
      })
    )

    try {
      await insertCommentary(database, 'paragraphs', 'fr', 'active', {
        '43-3-0': 'Introduction',
        ...Object.fromEntries(
          Array.from({ length: 21 }, (_, index) => [
            `43-3-${index + 1}`,
            index < 8 ? 'Nicodème' : 'La foi',
          ])
        ),
        // Neighbours that share a prefix of the chapter key are other chapters.
        '43-30-1': 'another chapter',
        '43-31-16': 'another chapter',
        '4-33-16': 'another book',
        '43-4-1': 'La Samaritaine',
      })
      await insertCommentary(database, 'verses', 'fr', 'active', {
        '43-3-15': 'Overview<hr>That whosoever',
        '43-3-16': 'Overview<hr>For God so loved<hr>The world',
        '43-3-17': 'Overview',
      })
      await insertCommentary(database, 'verses', 'fr', 'staged', { '43-3-16': 'A draft' })
      await insertCommentary(database, 'verses', 'en', 'active', { '43-3-16': 'English' })
      await insertCommentary(database, 'silent', 'fr', 'active', { '1-1-1': 'Genesis only' })
      await insertCommentary(database, 'draft', 'fr', 'staged', { '43-3-16': 'Not published' })

      statements = 0
      const chapters = await Effect.runPromise(
        repository.findCommentaryChapters({
          collections: ['verses', 'missing', 'silent', 'draft', 'paragraphs'],
          language: 'fr',
          book: 43,
          chapter: 3,
        })
      )
      assert.equal(statements, 1)
      assert.deepEqual(
        chapters.map(chapter => [
          chapter.collection,
          chapter.revision,
          Object.keys(chapter.comments).length,
        ]),
        [
          ['verses', 'verses-fr-active', 3],
          ['silent', 'silent-fr-active', 0],
          ['paragraphs', 'paragraphs-fr-active', 22],
        ]
      )
      assert.deepEqual(chapters[0]?.comments, {
        '15': 'Overview<hr>That whosoever',
        '16': 'Overview<hr>For God so loved<hr>The world',
        '17': 'Overview',
      })

      statements = 0
      assert.deepEqual(
        await Effect.runPromise(
          repository.findCommentaryChapters({
            collections: [],
            language: 'fr',
            book: 43,
            chapter: 3,
          })
        ),
        []
      )
      assert.equal(statements, 0)

      // The route answers like the chapter reads it replaces, for every verse.
      const web = makeResourceWebHandler(undefined, undefined, { supplementary: repository })
      try {
        const collections = ['verses', 'missing', 'silent', 'paragraphs']
        for (let verse = 1; verse <= 22; verse += 1) {
          const location = { book: 43, chapter: 3, verse }
          statements = 0
          const read = await sectionsFromOneRead(web.handler, collections, 'fr', location)
          assert.equal(statements, 1)
          assert.deepEqual(read.unavailable, ['missing'])
          assert.deepEqual(
            read.sections,
            await sectionsFromChapterReads(web.handler, collections, 'fr', location),
            `verse ${verse}`
          )
        }
        const john316 = await sectionsFromOneRead(web.handler, collections, 'fr', {
          book: 43,
          chapter: 3,
          verse: 16,
        })
        assert.deepEqual(
          john316.sections.map(section => [section.resource.resourceId, section.slug]),
          [
            ['verses', '16-16'],
            ['paragraphs', '9-21'],
          ]
        )
      } finally {
        await web.dispose()
      }
    } finally {
      await isolated.dispose()
    }
  })

  // John 3, Genesis 1, Psalm 23, Psalm 119, Matthew 17, Romans 8 and Jude.
  const REAL_CHAPTERS = [
    [43, 3, 36],
    [1, 1, 31],
    [19, 23, 6],
    [19, 119, 176],
    [40, 17, 27],
    [45, 8, 39],
    [65, 1, 25],
  ] as const

  it(
    'answers real chapters like the chapter reads of the public site',
    { skip: !bundlesRoot },
    async () => {
      const isolated = await createIsolatedPostgres(connectionString, 'verse_sections_real', 1)
      try {
        const collectionsByLanguage: Record<Language, string[]> = { fr: [], en: [] }
        for (const name of (await readdir(path.resolve(bundlesRoot!))).sort()) {
          const bundle = path.join(path.resolve(bundlesRoot!), name)
          if (!(await stat(path.join(bundle, 'manifest.json')).catch(() => undefined))) continue
          const imported = await Effect.runPromise(
            importPublicationBundle(bundle, isolated.database, {
              activateForLocalDevelopment: true,
            })
          )
          const [kind, collection, language] = imported.resourceIdentity.split(':')
          if (kind === 'commentary' && collection && (language === 'fr' || language === 'en')) {
            collectionsByLanguage[language].push(collection)
          }
        }

        const web = makeResourceWebHandler(undefined, undefined, {
          supplementary: makeKyselySupplementaryRepository(isolated.database),
        })
        try {
          let sections = 0
          for (const language of ['fr', 'en'] as const) {
            const collections = collectionsByLanguage[language].slice(0, 10)
            if (!collections.length) continue
            for (const [book, chapter, verses] of REAL_CHAPTERS) {
              for (let verse = 1; verse <= verses; verse += 1) {
                const location = { book, chapter, verse }
                const read = await sectionsFromOneRead(web.handler, collections, language, location)
                assert.deepEqual(read.unavailable, [])
                assert.deepEqual(
                  read.sections,
                  await sectionsFromChapterReads(web.handler, collections, language, location),
                  `${language} ${book}-${chapter}-${verse}`
                )
                sections += read.sections.length
              }
            }
          }
          assert.ok(sections > 0)
        } finally {
          await web.dispose()
        }
      } finally {
        await isolated.dispose()
      }
    }
  )
})
