import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { Effect } from 'effect'

import {
  SupplementaryContentNotFound,
  SupplementaryRepositoryFailure,
  type CommentaryChaptersLookup,
  type SupplementaryRepositoryService,
} from '../../domain/supplementary'
import { resourceApiCacheTtlSeconds } from '../../runtime/resourceApiCache'
import { makeResourceWebHandler } from '../app'

const unavailable = () =>
  Effect.fail(new SupplementaryContentNotFound({ resourceIdentity: 'fixture' }))

// John 3 in three commentaries: one comments it by paragraphs, one verse by verse with an
// overview of the chapter, one says nothing on it. A fourth is not published.
const CHAPTERS: Record<string, { revision: string; comments: Record<string, string> }> = {
  MHY: {
    revision: 'mhy-r1',
    comments: {
      ...Object.fromEntries(Array.from({ length: 8 }, (_, index) => [index + 1, 'Nicodème'])),
      ...Object.fromEntries(Array.from({ length: 13 }, (_, index) => [index + 9, 'La foi'])),
    },
  },
  barnes: {
    revision: 'barnes-r1',
    comments: {
      '0': 'Introduction',
      '15': 'Overview<hr>That whosoever',
      '16': 'Overview<hr>For God so loved<hr>The world',
      '17': 'Overview',
    },
  },
  jfb: { revision: 'jfb-r1', comments: {} },
}

const reads: CommentaryChaptersLookup[] = []
const supplementary: SupplementaryRepositoryService = {
  findCommentaryReadingIndex: unavailable,
  findCommentaryReadingSection: unavailable,
  findCommentaryVerse: unavailable,
  findCommentaryChapter: unavailable,
  findCommentaryCoverage: unavailable,
  findCrossReferences: unavailable,
  findCommentaryChapters: input => {
    reads.push(input)
    if (input.book === 99) {
      return Effect.fail(new SupplementaryRepositoryFailure({ cause: new Error('password=x') }))
    }
    return Effect.succeed(
      input.collections.flatMap(collection => {
        const chapter = input.book === 43 && input.chapter === 3 && CHAPTERS[collection]
        return chapter ? [{ collection, ...chapter }] : []
      })
    )
  },
}

const sectionsPath = '/v1/commentaries/verses/43-3-16/sections'
const read = async (path: string) => {
  const web = makeResourceWebHandler(undefined, undefined, { supplementary })
  try {
    return await web.handler(
      new Request(`http://localhost${path}`, { headers: { 'x-request-id': 'verse-sections' } })
    )
  } finally {
    await web.dispose()
  }
}

describe('v1 commentary verse sections API', () => {
  it('returns, for each commentary, the section closest to the verse in one read', async () => {
    reads.length = 0
    const response = await read(`${sectionsPath}?language=fr&commentaries=barnes,jfb,MHY,missing`)

    assert.equal(response.status, 200)
    assert.equal(response.headers.get('x-request-id'), 'verse-sections')
    assert.equal(response.headers.get('x-resource-revisions'), 'barnes:fr:barnes-r1,MHY:fr:mhy-r1')
    assert.deepEqual(await response.json(), {
      verseKey: '43-3-16',
      sections: [
        {
          resource: {
            kind: 'commentary',
            resourceId: 'barnes',
            language: 'fr',
            revision: 'barnes-r1',
          },
          // Of the two comments on this verse alone, the first one read.
          slug: '16-16',
          startVerse: 16,
          endVerse: 16,
          content: 'For God so loved',
        },
        {
          resource: { kind: 'commentary', resourceId: 'MHY', language: 'fr', revision: 'mhy-r1' },
          slug: '9-21',
          startVerse: 9,
          endVerse: 21,
          content: 'La foi',
        },
      ],
      unavailable: ['missing'],
    })
    assert.deepEqual(reads, [
      {
        collections: ['barnes', 'jfb', 'MHY', 'missing'],
        language: 'fr',
        book: 43,
        chapter: 3,
        verse: 16,
      },
    ])
  })

  it('falls back on the comment that covers the verse among others', async () => {
    const response = await read(
      '/v1/commentaries/verses/43-3-17/sections?language=en&commentaries=barnes'
    )
    const payload = (await response.json()) as { sections: { slug: string }[] }
    assert.deepEqual(
      payload.sections.map(section => section.slug),
      ['15-17']
    )
  })

  it('answers a verse no commentary comments with no section', async () => {
    const response = await read(
      '/v1/commentaries/verses/43-4-1/sections?language=fr&commentaries=MHY'
    )
    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), {
      verseKey: '43-4-1',
      sections: [],
      unavailable: ['MHY'],
    })
  })

  it('rejects a malformed verse or list of commentaries', async () => {
    for (const path of [
      `${sectionsPath}?language=fr`,
      `${sectionsPath}?language=fr&commentaries=`,
      `${sectionsPath}?language=fr&commentaries=barnes,barnes`,
      `${sectionsPath}?language=fr&commentaries=barnes,../jfb`,
      `${sectionsPath}?language=fr&commentaries=${Array.from({ length: 11 }, (_, index) => `c${index}`).join(',')}`,
      `${sectionsPath}?language=de&commentaries=barnes`,
      '/v1/commentaries/verses/43-3-0/sections?language=fr&commentaries=barnes',
      '/v1/commentaries/verses/43-3/sections?language=fr&commentaries=barnes',
    ]) {
      assert.equal((await read(path)).status, 400, path)
    }
  })

  it('hides the cause of a failed read', async () => {
    const response = await read(
      '/v1/commentaries/verses/99-1-1/sections?language=fr&commentaries=barnes'
    )
    assert.equal(response.status, 500)
    assert.doesNotMatch(await response.text(), /password/u)
  })

  it('is kept by the Worker like the other revisioned reads', () => {
    const request = new Request(
      `https://api.bible-strong.app${sectionsPath}?language=fr&commentaries=barnes,MHY`
    )
    assert.equal(resourceApiCacheTtlSeconds(request), 30 * 24 * 60 * 60)
  })
})
