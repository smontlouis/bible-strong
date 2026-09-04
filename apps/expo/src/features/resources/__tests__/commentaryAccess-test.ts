/* eslint-disable import/first */

jest.mock('expo-file-system/legacy', () => ({ getInfoAsync: jest.fn() }))
jest.mock('~helpers/databases', () => ({ getCommentaryDbPath: jest.fn() }))
jest.mock('~helpers/sqlite', () => ({ openSQLiteDatabase: jest.fn() }))
jest.mock('../resourceAvailability', () => ({
  getLocalResourceAvailability: jest.fn(),
  offlineResourceRegistry: { markCorrupt: jest.fn() },
}))

import {
  createCommentaryAccess,
  createHttpCommentaryChapterSource,
  localCommentaryChapterSource,
  type CommentaryChapterSource,
} from '../commentaryAccess'
import { ResourceAccessError } from '../resourceAccessError'
import { getCommentaryDbPath } from '~helpers/databases'
import { openSQLiteDatabase } from '~helpers/sqlite'
import { getLocalResourceAvailability } from '../resourceAvailability'

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
  it('reads normalized EGW documents from the offline SQLite artifact', async () => {
    jest.mocked(getLocalResourceAvailability).mockResolvedValue({ status: 'available' } as never)
    jest.mocked(getCommentaryDbPath).mockReturnValue('/documents/commentary-egw-writings-en.sqlite')
    const database = {
      getFirstAsync: jest.fn().mockResolvedValue({ name: 'COMMENTARY_DOCUMENTS' }),
      getAllAsync: jest.fn().mockResolvedValue([
        { verse_key: '1-1-1', ordinal: 0, content: '<p>First.</p>' },
        { verse_key: '1-1-1', ordinal: 1, content: '<p>Second.</p>' },
        { verse_key: '1-1-2', ordinal: 0, content: '<p>Third.</p>' },
      ]),
      closeAsync: jest.fn(),
    }
    jest.mocked(openSQLiteDatabase).mockResolvedValue(database as never)

    await expect(
      localCommentaryChapterSource.loadResourceChapter('egw-writings', 'en', 1, 1)
    ).resolves.toEqual({
      1: '<p>First.</p><hr><p>Second.</p>',
      2: '<p>Third.</p>',
    })
    expect(database.closeAsync).toHaveBeenCalled()
  })

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
      content: fullContent,
    })
    expect(chapter.sections[0].content.length).toBeGreaterThan(1_200)
    expect(chapter.sections[1]).toMatchObject({
      rangeStartVerse: 3,
      rangeEndVerse: 3,
    })
  })

  it('reports how many reconstructed sections cover each verse preview', async () => {
    const local = source(async () => ({
      1: '<p>Whole passage</p><hr><p>First verse only</p>',
      2: '<p>Whole passage</p>',
    }))
    const access = createCommentaryAccess({ local, isOnline: async () => false })

    const chapter = await access.loadChapter({
      book: 1,
      chapter: 1,
      resources: [{ resourceId: 'barnes', language: 'en' }],
    })

    expect(chapter.commentsByVerse['1'][0].matchingSectionCount).toBe(2)
    expect(chapter.commentsByVerse['2'][0].matchingSectionCount).toBe(1)
  })

  it('presents consecutive EGW paragraphs from one source section as one reading unit', async () => {
    const paragraph = (reference: string, content: string, sourceId: string) =>
      `<h3>Daughters of God</h3><h4>Eve, Mother of All</h4><p><strong>${reference}</strong></p><span>${content}</span><p><a class="external-source" href="https://text.egwwritings.org/read/27.${sourceId}">View “Eve, Mother of All” in context ↗</a></p>`
    const first = paragraph('DG 21.1', 'First paragraph.', '58')
    const second = paragraph('DG 21.2', 'Second paragraph.', '59')
    const local = source(async () => ({
      1: `${first}<hr>${second}`,
      2: `${first}<hr>${second}`,
    }))
    const access = createCommentaryAccess({ local, isOnline: async () => false })

    const chapter = await access.loadResourceChapter({
      resourceId: 'egw-writings',
      language: 'en',
      book: 1,
      chapter: 1,
    })

    expect(chapter.sections).toHaveLength(1)
    expect(chapter.sections[0]).toMatchObject({
      rangeStartVerse: 1,
      rangeEndVerse: 2,
    })
    expect(chapter.sections[0].content.match(/<h3>/gu)).toHaveLength(1)
    expect(chapter.sections[0].content.match(/<h4>/gu)).toHaveLength(1)
    expect(chapter.sections[0].content).toContain('DG 21.1')
    expect(chapter.sections[0].content).toContain('DG 21.2')
    expect(chapter.sections[0].content).toContain('<br /><br />')
    expect(chapter.sections[0].content.match(/external-source/gu)).toHaveLength(1)
    expect(chapter.sections[0].content.indexOf('DG 21.1')).toBeLessThan(
      chapter.sections[0].content.indexOf('DG 21.2')
    )
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
        content: shared,
      }),
      expect.objectContaining({
        rangeStartVerse: 2,
        rangeEndVerse: 2,
        content: verseTwo,
      }),
      expect.objectContaining({
        rangeStartVerse: 3,
        rangeEndVerse: 5,
        content: nextShared,
      }),
    ])
  })

  it('uses the same section identity in verse previews and the commentary room', async () => {
    const shared = '<p>James explains the causes of conflict among people.</p>'
    const local = source(async () => ({
      4: `${shared}<hr><p>Verse four</p>`,
      5: `${shared}<hr><p>Verse five</p>`,
      6: shared,
      7: `${shared}<hr><p>Verse seven</p>`,
      8: `${shared}<hr><p>Verse eight</p>`,
      9: shared,
      10: `${shared}<hr><p>Verse ten</p>`,
    }))
    const access = createCommentaryAccess({ local, isOnline: async () => false })

    const [verseChapter, resourceChapter] = await Promise.all([
      access.loadChapter({
        book: 59,
        chapter: 4,
        resources: [{ resourceId: 'aquifer-fr', language: 'en' }],
      }),
      access.loadResourceChapter({
        resourceId: 'aquifer-fr',
        language: 'en',
        book: 59,
        chapter: 4,
      }),
    ])

    const verseComment = verseChapter.commentsByVerse['6'][0]
    expect(resourceChapter.sections.some(section => section.id === verseComment.sectionId)).toBe(
      true
    )
    expect(verseComment).toMatchObject({
      sectionId: 'aquifer-fr-en-59-4-4-10',
      rangeStartVerse: 4,
      rangeEndVerse: 10,
      content: 'James explains the causes of conflict among people.',
    })
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
