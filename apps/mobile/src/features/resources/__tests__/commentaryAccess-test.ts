/* eslint-disable import/first */

jest.mock('expo-file-system/legacy', () => ({ getInfoAsync: jest.fn() }))
jest.mock('~helpers/databases', () => ({ getCommentaryDbPath: jest.fn() }))
jest.mock('~helpers/sqlite', () => ({ openSQLiteDatabase: jest.fn() }))

import {
  createCommentaryAccess,
  createHttpCommentaryChapterSource,
  type CommentaryChapterSource,
} from '../commentaryAccess'
import { ResourceAccessError } from '../resourceAccessError'

const request = {
  book: 1,
  chapter: 1,
  resources: [
    { resourceId: 'barnes', language: 'fr' as const },
    { resourceId: 'acbc', language: 'fr' as const },
  ],
}

const source = (
  implementation: CommentaryChapterSource['loadResourceChapter'],
  coverage: CommentaryChapterSource['loadResourceCoverage'] = async () => ({
    books: [1],
    chaptersByBook: { 1: [1] },
  })
): CommentaryChapterSource => ({
  loadResourceChapter: jest.fn(implementation),
  loadResourceCoverage: jest.fn(coverage),
})

describe('commentary access', () => {
  it('prefers installed coverage and preserves its compact selector shape', async () => {
    const local = source(
      async () => ({}),
      async () => ({ books: [19, 41], chaptersByBook: { 19: [1, 3], 41: [1] } })
    )
    const remote = source(async () => {
      throw new Error('remote should not be called')
    })
    const access = createCommentaryAccess({ local, remote, isOnline: async () => true })

    await expect(
      access.loadResourceCoverage({ resourceId: 'barnes', language: 'fr' })
    ).resolves.toEqual({
      resourceId: 'barnes',
      language: 'fr',
      books: [19, 41],
      chaptersByBook: { 19: [1, 3], 41: [1] },
    })
    expect(remote.loadResourceCoverage).not.toHaveBeenCalled()
  })

  it('loads selected installed resources in selection order without calling the API', async () => {
    const local = source(async publicationId => ({
      1: publicationId === 'barnes' ? 'Barnes FR' : 'Clarke FR',
    }))
    const remote = source(async () => {
      throw new Error('remote should not be called')
    })
    const access = createCommentaryAccess({ local, remote, isOnline: async () => true })

    const chapter = await access.loadChapter(request)

    expect(chapter.commentsByVerse['1'].map(comment => comment.resource.code)).toEqual([
      'barnes:fr',
      'acbc:fr',
    ])
    expect(remote.loadResourceChapter).not.toHaveBeenCalled()
  })

  it('falls back to the chapter API only for resources without an Offline copy', async () => {
    const local = source(async publicationId => {
      if (publicationId === 'barnes') return { 1: 'Barnes local' }
      throw new ResourceAccessError('OFFLINE_COPY_REQUIRED', ['acquire-offline-copy'])
    })
    const remote = source(async publicationId => ({ 1: `${publicationId} remote` }))
    const access = createCommentaryAccess({ local, remote, isOnline: async () => true })

    const chapter = await access.loadChapter(request)

    expect(chapter.commentsByVerse['1'].map(comment => comment.content)).toEqual([
      'Barnes local',
      'acbc remote',
    ])
    expect(remote.loadResourceChapter).toHaveBeenCalledTimes(1)
  })

  it('keeps installed comments available offline and reports missing selected resources', async () => {
    const local = source(async publicationId => {
      if (publicationId === 'barnes') return { 1: 'Barnes local' }
      throw new ResourceAccessError('OFFLINE_COPY_REQUIRED', ['acquire-offline-copy'])
    })
    const remote = source(jest.fn())
    const access = createCommentaryAccess({ local, remote, isOnline: async () => false })

    const chapter = await access.loadChapter(request)

    expect(chapter.commentsByVerse['1']).toHaveLength(1)
    expect(chapter.unavailableResources).toEqual([
      { resourceId: 'acbc', language: 'fr', cause: 'offline-copy-required' },
    ])
    expect(remote.loadResourceChapter).not.toHaveBeenCalled()
  })

  it('loads French and English projections in one ordered request', async () => {
    const local = source(async (publicationId, language) => ({
      1: `${publicationId} ${language}`,
    }))
    const access = createCommentaryAccess({ local, isOnline: async () => false })

    const chapter = await access.loadChapter({
      book: 1,
      chapter: 1,
      resources: [
        { resourceId: 'barnes', language: 'fr' },
        { resourceId: 'barnes', language: 'en' },
      ],
    })

    expect(chapter.commentsByVerse['1'].map(comment => comment.content)).toEqual([
      'barnes fr',
      'barnes en',
    ])
    expect(chapter.commentsByVerse['1'].map(comment => comment.id)).toEqual([
      'barnes-fr-1-1-1',
      'barnes-en-1-1-1',
    ])
  })

  it('reconstructs contiguous verse ranges from the packaged chapter content', async () => {
    const local = source(async () => ({
      1: 'One section',
      2: 'One section',
      3: 'One section',
      4: 'Another section',
    }))
    const access = createCommentaryAccess({ local, isOnline: async () => false })

    const chapter = await access.loadChapter({
      book: 41,
      chapter: 1,
      resources: [{ resourceId: 'barnes', language: 'en' }],
    })

    expect(chapter.commentsByVerse['2'][0]).toMatchObject({
      rangeStartVerse: 1,
      rangeEndVerse: 3,
    })
    expect(chapter.commentsByVerse['4'][0]).toMatchObject({
      rangeStartVerse: 4,
      rangeEndVerse: 4,
    })
  })

  it('exposes a plain-text preview instead of the complete commentary HTML', async () => {
    const local = source(async () => ({
      1: `<p><b>Heading</b> ${'Long commentary '.repeat(200)}</p>`,
    }))
    const access = createCommentaryAccess({ local, isOnline: async () => false })

    const chapter = await access.loadChapter({
      book: 41,
      chapter: 1,
      resources: [{ resourceId: 'barnes', language: 'en' }],
    })
    const preview = chapter.commentsByVerse['1'][0].content

    expect(preview).toMatch(/^Heading Long commentary/u)
    expect(preview).not.toContain('<')
    expect(preview.length).toBeLessThanOrEqual(1_200)
  })

  it('loads full deduplicated sections only when opening one commentary resource', async () => {
    const fullContent = `<h3>The beginning</h3><p>${'Complete commentary '.repeat(100)}</p>`
    const local = source(async () => ({
      1: fullContent,
      2: fullContent,
      3: '<p>Another section</p>',
    }))
    const access = createCommentaryAccess({ local, isOnline: async () => false })

    const chapter = await access.loadResourceChapter({
      resourceId: 'barnes',
      language: 'en',
      book: 41,
      chapter: 1,
    })

    expect(chapter.sections).toHaveLength(2)
    expect(chapter.sections[0]).toMatchObject({
      id: 'barnes-en-41-1-1-2',
      rangeStartVerse: 1,
      rangeEndVerse: 2,
      title: 'The beginning',
      content: fullContent,
    })
    expect(chapter.sections[0].content.length).toBeGreaterThan(1_200)
    expect(chapter.sections[1]).toMatchObject({
      rangeStartVerse: 3,
      rangeEndVerse: 3,
    })
  })

  it('reconstructs overlapping shared and verse-specific sections separated by hr', async () => {
    const shared = '<h3>1–2: Shared section</h3><p>Shared commentary</p>'
    const verseTwo = '<h3>Verse two</h3><p>Specific commentary</p>'
    const nextShared = '<h3>3–5: Next section</h3><p>Another shared commentary</p>'
    const local = source(async () => ({
      1: shared,
      2: `${shared}<hr>${verseTwo}`,
      3: nextShared,
      4: nextShared,
      5: nextShared,
    }))
    const access = createCommentaryAccess({ local, isOnline: async () => false })

    const chapter = await access.loadResourceChapter({
      resourceId: 'barnes',
      language: 'en',
      book: 1,
      chapter: 1,
    })

    expect(chapter.sections).toHaveLength(3)
    expect(chapter.sections).toEqual([
      expect.objectContaining({
        rangeStartVerse: 1,
        rangeEndVerse: 2,
        title: '1–2: Shared section',
        content: shared,
      }),
      expect.objectContaining({
        rangeStartVerse: 2,
        rangeEndVerse: 2,
        title: 'Verse two',
        content: verseTwo,
      }),
      expect.objectContaining({
        rangeStartVerse: 3,
        rangeEndVerse: 5,
        title: '3–5: Next section',
        content: nextShared,
      }),
    ])
  })

  it('requests and validates one complete chapter from the resource API', async () => {
    const fetcher = jest.fn(
      async (_input: string | URL | Request, _init?: RequestInit) =>
        new Response(
          JSON.stringify({
            resource: {
              kind: 'commentary',
              resourceId: 'barnes',
              language: 'fr',
              revision: 'barnes-fr-r1',
            },
            book: 1,
            chapter: 1,
            serializedComments: JSON.stringify({ 1: 'Au commencement', 2: 'La terre' }),
          }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        )
    )
    const http = createHttpCommentaryChapterSource({
      baseUrl: 'https://resources.example/',
      fetcher,
      isOnline: async () => true,
    })

    await expect(http.loadResourceChapter('barnes', 'fr', 1, 1)).resolves.toEqual({
      1: 'Au commencement',
      2: 'La terre',
    })
    expect(fetcher).toHaveBeenCalledWith(
      'https://resources.example/v1/commentaries/barnes/fr/chapters/1/1',
      expect.objectContaining({ headers: { accept: 'application/json' } })
    )
  })

  it('requests and validates compact commentary coverage from the resource API', async () => {
    const fetcher = jest.fn(
      async () =>
        new Response(
          JSON.stringify({
            resource: {
              kind: 'commentary',
              resourceId: 'barnes',
              language: 'fr',
              revision: 'barnes-fr-r1',
            },
            books: [1, 19, 41],
            chaptersByBook: { 1: [1, 2], 19: [1], 41: [1, 2, 3] },
          }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        )
    )
    const http = createHttpCommentaryChapterSource({
      baseUrl: 'https://resources.example/',
      fetcher,
      isOnline: async () => true,
    })

    await expect(http.loadResourceCoverage('barnes', 'fr')).resolves.toEqual({
      books: [1, 19, 41],
      chaptersByBook: { 1: [1, 2], 19: [1], 41: [1, 2, 3] },
    })
    expect(fetcher).toHaveBeenCalledWith(
      'https://resources.example/v1/commentaries/barnes/fr/coverage',
      expect.objectContaining({ headers: { accept: 'application/json' } })
    )
  })

  it('rejects a chapter response for another publication', async () => {
    const fetcher = jest.fn(
      async (_input: string | URL | Request, _init?: RequestInit) =>
        new Response(
          JSON.stringify({
            resource: {
              kind: 'commentary',
              resourceId: 'acbc',
              language: 'fr',
              revision: 'acbc-fr-r1',
            },
            book: 1,
            chapter: 1,
            serializedComments: '{}',
          }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        )
    )
    const http = createHttpCommentaryChapterSource({
      baseUrl: 'https://resources.example',
      fetcher,
      isOnline: async () => true,
    })

    await expect(http.loadResourceChapter('barnes', 'fr', 1, 1)).rejects.toMatchObject({
      code: 'INTEGRITY_FAILURE',
    })
  })
})
