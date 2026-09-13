import assert from 'node:assert/strict'
import { test } from 'node:test'
import { Effect } from 'effect'
import {
  ActiveSupplementaryPublicationUnavailable,
  SupplementaryContentNotFound,
  type SupplementaryRepositoryService,
} from '../../domain/supplementary'
import { makeResourceWebHandler } from '../app'

const unavailable = () =>
  Effect.fail(new SupplementaryContentNotFound({ resourceIdentity: 'fixture' }))
const repository: SupplementaryRepositoryService = {
  findCommentaryVerse: unavailable,
  findCommentaryChapter: unavailable,
  findCommentaryCoverage: unavailable,
  findCrossReferences: unavailable,
  findCommentaryReadingIndex: input =>
    input.collection === 'missing'
      ? Effect.fail(new ActiveSupplementaryPublicationUnavailable({ resourceIdentity: 'missing' }))
      : Effect.succeed({
          revision: 'revision-one',
          sections: [
            { id: 'section-1', rangeStartVerse: 1, rangeEndVerse: 3, excerpt: 'A short preview.' },
          ],
        }),
  findCommentaryReadingSection: input =>
    input.revision === 'revision-one' && input.sectionId === 'section-1'
      ? Effect.succeed({
          revision: input.revision,
          section: {
            id: input.sectionId,
            rangeStartVerse: 1,
            rangeEndVerse: 3,
            content: '<p>Complete commentary.</p>',
          },
        })
      : unavailable(),
}
const post = (path: string, payload: unknown) =>
  new Request(`http://localhost${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  })

test('permits authenticated JSON POST preflights from configured browser origins', async () => {
  const app = makeResourceWebHandler(
    undefined,
    undefined,
    { supplementary: repository },
    { corsAllowedOrigins: ['https://bible-strong.app'] }
  )
  try {
    const response = await app.handler(
      new Request('https://api.bible-strong.app/v1/commentaries/reading-index', {
        method: 'OPTIONS',
        headers: {
          origin: 'https://bible-strong.app',
          'access-control-request-method': 'POST',
          'access-control-request-headers': 'content-type,x-firebase-appcheck',
        },
      })
    )
    assert.equal(response.status, 204)
    assert.equal(response.headers.get('access-control-allow-origin'), 'https://bible-strong.app')
    assert.match(response.headers.get('access-control-allow-methods') ?? '', /POST/)
    assert.match(response.headers.get('access-control-allow-headers') ?? '', /x-firebase-appcheck/)
  } finally {
    await app.dispose()
  }
})

test('returns one bounded batch of metadata, isolates missing resources, never includes full content', async () => {
  const app = makeResourceWebHandler(undefined, undefined, { supplementary: repository })
  try {
    const response = await app.handler(
      post('/v1/commentaries/reading-index', {
        book: 1,
        chapter: 1,
        resources: [
          { resourceId: 'barnes', language: 'fr' },
          { resourceId: 'missing', language: 'en' },
        ],
      })
    )
    assert.equal(response.status, 200)
    const payload = (await response.json()) as {
      indexes: { resource: { revision: string }; sections: { excerpt: string }[] }[]
      unavailable: unknown[]
    }
    assert.equal(payload.indexes[0].resource.revision, 'revision-one')
    assert.equal(payload.indexes[0].sections[0].excerpt, 'A short preview.')
    assert.ok(!JSON.stringify(payload).includes('Complete commentary'))
    assert.equal(payload.unavailable.length, 1)
    const oversized = await app.handler(
      post('/v1/commentaries/reading-index', {
        book: 1,
        chapter: 1,
        resources: Array.from({ length: 6 }, () => ({ resourceId: 'barnes', language: 'fr' })),
      })
    )
    assert.equal(oversized.status, 400)
  } finally {
    await app.dispose()
  }
})

test('opens the exact revision from the index and rejects unavailable revisions', async () => {
  const app = makeResourceWebHandler(undefined, undefined, { supplementary: repository })
  const input = {
    resourceId: 'barnes',
    language: 'fr',
    book: 1,
    chapter: 1,
    revision: 'revision-one',
    sectionId: 'section-1',
  }
  try {
    const response = await app.handler(post('/v1/commentaries/reading-section', input))
    assert.equal(response.status, 200)
    const payload = (await response.json()) as {
      resource: { revision: string }
      section: { content: string }
    }
    assert.equal(payload.resource.revision, input.revision)
    assert.equal(payload.section.content, '<p>Complete commentary.</p>')
    const stale = await app.handler(
      post('/v1/commentaries/reading-section', { ...input, revision: 'other-revision' })
    )
    assert.equal(stale.status, 404)
  } finally {
    await app.dispose()
  }
})
