import { withResourceSourceLogging } from './resourceSourceLogger'
import {
  buildCommentaryResourceSections,
  createCommentaryPreview,
  createCommentarySectionId,
  type CommentaryResourceSection,
} from '@bible-strong/resource-domain/contracts/commentarySections'
import { COMMENTARY_CATALOG_BY_ID } from '@bible-strong/resource-catalog/commentaries'
import * as Schema from 'effect/Schema'

import type { Comment } from '~features/commentaries/types'
import { getCommentaryDbPath } from '~helpers/databases'
import type { ResourceLanguage } from '~helpers/databaseTypes'
import { openSQLiteDatabase } from '~helpers/sqlite'
import {
  CommentaryChapterResponseDto,
  CommentaryCoverageResponseDto,
  CommentaryVerseSectionsResponseDto,
} from './supplementaryContract'
import { ResourceAccessError, resourceAccessErrorFromHttpResponse } from './resourceAccessError'
import { getLocalResourceAvailability, offlineResourceRegistry } from './resourceAvailability'

export type { CommentaryResourceSection } from '@bible-strong/resource-domain/contracts/commentarySections'

export type CommentaryChapterRequest = {
  book: number
  chapter: number
  resources: readonly CommentaryResourceSelection[]
}

export type CommentaryResourceSelection = {
  resourceId: string
  language: ResourceLanguage
}

export type CommentaryUnavailableResource = {
  resourceId: string
  language: ResourceLanguage
  cause: 'offline-copy-required' | 'temporary-unavailable' | 'invalid-offline-copy'
}

export type CommentaryChapter = {
  book: number
  chapter: number
  commentsByVerse: Record<string, Comment[]>
  unavailableResources: CommentaryUnavailableResource[]
}

export type CommentaryResourceChapter = {
  resourceId: string
  language: ResourceLanguage
  book: number
  chapter: number
  sections: CommentaryResourceSection[]
}

export type CommentaryResourceCoverage = {
  resourceId: string
  language: ResourceLanguage
  books: number[]
  chaptersByBook: Record<number, number[]>
}

/** How a commentary begins on one verse: the section of it that bears most closely on it. */
export type CommentaryVerseExcerpt = {
  resourceId: string
  language: ResourceLanguage
  title: string
  rangeStartVerse: number
  rangeEndVerse: number
  preview: string
}

export type CommentaryAccess = {
  loadChapter: (request: CommentaryChapterRequest) => Promise<CommentaryChapter>
  /**
   * The excerpt of each commentary on one verse, in the order asked. An offline copy is read
   * from its chapter; the others come from the Resource API in one small read per language,
   * not as whole chapters (ADR-0088).
   */
  loadVerseExcerpts?: (request: {
    verseKey: string
    resources: readonly CommentaryResourceSelection[]
  }) => Promise<CommentaryVerseExcerpt[]>
  loadResourceChapter: (
    request: CommentaryResourceSelection & { book: number; chapter: number }
  ) => Promise<CommentaryResourceChapter>
  loadResourceCoverage: (
    request: CommentaryResourceSelection
  ) => Promise<CommentaryResourceCoverage>
}

type SerializedCommentaryChapter = Record<string, string>

export type CommentaryChapterSource = {
  loadResourceChapter: (
    publicationId: string,
    language: ResourceLanguage,
    book: number,
    chapter: number
  ) => Promise<SerializedCommentaryChapter>
  loadResourceCoverage: (
    publicationId: string,
    language: ResourceLanguage
  ) => Promise<Pick<CommentaryResourceCoverage, 'books' | 'chaptersByBook'>>
  /** The section of each publication that bears most closely on a verse, in one read. */
  loadVerseSections?: (
    publicationIds: readonly string[],
    language: ResourceLanguage,
    verseKey: string
  ) => Promise<{ publicationId: string; startVerse: number; endVerse: number; content: string }[]>
}

const buildCommentaryCoverage = (chapterIds: readonly string[]) => {
  const chapters = new Map<number, Set<number>>()
  for (const chapterId of chapterIds) {
    const match = /^(\d+)-(\d+)$/u.exec(chapterId)
    if (!match) continue
    const book = Number(match[1])
    const chapter = Number(match[2])
    if (book < 1 || chapter < 1) continue
    const bookChapters = chapters.get(book) ?? new Set<number>()
    bookChapters.add(chapter)
    chapters.set(book, bookChapters)
  }
  const books = [...chapters.keys()].sort((left, right) => left - right)
  return {
    books,
    chaptersByBook: Object.fromEntries(
      books.map(book => [book, [...chapters.get(book)!].sort((left, right) => left - right)])
    ),
  }
}

const decodeSerializedComments = (value: string): SerializedCommentaryChapter => {
  try {
    const decoded: unknown = JSON.parse(value)
    if (!decoded || typeof decoded !== 'object' || Array.isArray(decoded)) {
      throw new Error('COMMENTARY_CHAPTER_INVALID')
    }
    const entries = Object.entries(decoded)
    if (entries.some(([verse, content]) => !/^\d+$/u.test(verse) || typeof content !== 'string')) {
      throw new Error('COMMENTARY_CHAPTER_INVALID')
    }
    return Object.fromEntries(entries) as SerializedCommentaryChapter
  } catch {
    throw new ResourceAccessError('INTEGRITY_FAILURE')
  }
}

const hasNormalizedCommentarySchema = async (
  database: Awaited<ReturnType<typeof openSQLiteDatabase>>
) =>
  Boolean(
    await database.getFirstAsync<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'COMMENTARY_DOCUMENTS'"
    )
  )

export const localCommentaryChapterSource: CommentaryChapterSource = {
  async loadResourceChapter(publicationId, language, book, chapter) {
    const availability = await getLocalResourceAvailability({
      kind: 'commentary',
      resourceId: publicationId,
      language,
    })
    if (availability.status !== 'available') {
      throw new ResourceAccessError(
        availability.status === 'corrupt' ? 'INVALID_OFFLINE_COPY' : 'OFFLINE_COPY_REQUIRED',
        ['acquire-offline-copy']
      )
    }
    const path = getCommentaryDbPath(publicationId, language)
    const fileName = path.split('/').pop()!
    const directory = path.slice(0, -(fileName.length + 1))
    let database: Awaited<ReturnType<typeof openSQLiteDatabase>> | undefined
    try {
      database = await openSQLiteDatabase(fileName, { useNewConnection: true }, directory)
      if (await hasNormalizedCommentarySchema(database)) {
        const prefix = `${book}-${chapter}-`
        const rows = await database.getAllAsync<{
          verse_key: string
          ordinal: number
          content: string
        }>(
          `SELECT links.verse_key, links.ordinal, documents.content
             FROM COMMENTARY_VERSE_DOCUMENTS links
             JOIN COMMENTARY_DOCUMENTS documents ON documents.id = links.document_id
            WHERE links.verse_key LIKE ?
            ORDER BY CAST(substr(links.verse_key, ?) AS INTEGER), links.ordinal`,
          `${prefix}%`,
          prefix.length + 1
        )
        const chapterContent: SerializedCommentaryChapter = {}
        for (const row of rows) {
          const verse = row.verse_key.slice(prefix.length)
          chapterContent[verse] = chapterContent[verse]
            ? `${chapterContent[verse]}<hr>${row.content}`
            : row.content
        }
        return chapterContent
      }
      const row = await database.getFirstAsync<{ commentaires: string }>(
        'SELECT commentaires FROM COMMENTAIRES WHERE id = ?',
        `${book}-${chapter}`
      )
      return row ? decodeSerializedComments(row.commentaires) : {}
    } catch (error) {
      if (error instanceof ResourceAccessError) throw error
      offlineResourceRegistry.markCorrupt({
        kind: 'commentary',
        resourceId: publicationId,
        language,
      })
      throw new ResourceAccessError('INVALID_OFFLINE_COPY', [
        'acquire-offline-copy',
        'manage-offline-copies',
      ])
    } finally {
      await database?.closeAsync()
    }
  },
  async loadResourceCoverage(publicationId, language) {
    const availability = await getLocalResourceAvailability({
      kind: 'commentary',
      resourceId: publicationId,
      language,
    })
    if (availability.status !== 'available') {
      throw new ResourceAccessError(
        availability.status === 'corrupt' ? 'INVALID_OFFLINE_COPY' : 'OFFLINE_COPY_REQUIRED',
        ['acquire-offline-copy']
      )
    }
    const path = getCommentaryDbPath(publicationId, language)
    const fileName = path.split('/').pop()!
    const directory = path.slice(0, -(fileName.length + 1))
    let database: Awaited<ReturnType<typeof openSQLiteDatabase>> | undefined
    try {
      database = await openSQLiteDatabase(fileName, { useNewConnection: true }, directory)
      if (await hasNormalizedCommentarySchema(database)) {
        const rows = await database.getAllAsync<{ verse_key: string }>(
          'SELECT DISTINCT verse_key FROM COMMENTARY_VERSE_DOCUMENTS'
        )
        return buildCommentaryCoverage(rows.map(row => row.verse_key.replace(/-\d+$/u, '')))
      }
      const rows = await database.getAllAsync<{ id: string }>('SELECT id FROM COMMENTAIRES')
      return buildCommentaryCoverage(rows.map(row => row.id))
    } catch (error) {
      if (error instanceof ResourceAccessError) throw error
      offlineResourceRegistry.markCorrupt({
        kind: 'commentary',
        resourceId: publicationId,
        language,
      })
      throw new ResourceAccessError('INVALID_OFFLINE_COPY', [
        'acquire-offline-copy',
        'manage-offline-copies',
      ])
    } finally {
      await database?.closeAsync()
    }
  },
}

type HttpCommentaryAccessOptions = {
  baseUrl: string
  fetcher?: typeof fetch
  isOnline: () => Promise<boolean>
  /** Explains a request that failed without a response; defaults to the online gate. */
  isOfflineFailure?: () => Promise<boolean>
  timeoutMs?: number
}

export const createHttpCommentaryChapterSource = ({
  baseUrl,
  fetcher = fetch,
  isOnline,
  isOfflineFailure = async () => !(await isOnline()),
  timeoutMs = 10_000,
}: HttpCommentaryAccessOptions): CommentaryChapterSource => {
  const normalizedBaseUrl = baseUrl.replace(/\/+$/u, '')
  return {
    async loadResourceChapter(publicationId, language, book, chapter) {
      if (!(await isOnline())) throw new ResourceAccessError('NETWORK_OFFLINE')
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), timeoutMs)
      try {
        const response = await fetcher(
          `${normalizedBaseUrl}/v1/commentaries/${encodeURIComponent(publicationId)}/${language}/chapters/${book}/${chapter}`,
          { headers: { accept: 'application/json' }, signal: controller.signal }
        )
        const payload: unknown = await response.json().catch(() => undefined)
        if (!response.ok) {
          const code =
            payload && typeof payload === 'object' && 'code' in payload ? payload.code : undefined
          if (response.status === 404 && code === 'SUPPLEMENTARY_CONTENT_NOT_FOUND') return {}
          throw resourceAccessErrorFromHttpResponse('TEMPORARY_UNAVAILABLE', response, code)
        }

        let decoded: Schema.Schema.Type<typeof CommentaryChapterResponseDto>
        try {
          decoded = Schema.decodeUnknownSync(CommentaryChapterResponseDto)(payload)
        } catch {
          throw new ResourceAccessError('INTEGRITY_FAILURE')
        }
        if (
          decoded.resource.resourceId !== publicationId ||
          decoded.resource.language !== language ||
          decoded.book !== book ||
          decoded.chapter !== chapter
        ) {
          throw new ResourceAccessError('INTEGRITY_FAILURE')
        }
        return decodeSerializedComments(decoded.serializedComments)
      } catch (error) {
        if (error instanceof ResourceAccessError) throw error
        throw new ResourceAccessError(
          (await isOfflineFailure()) ? 'NETWORK_OFFLINE' : 'TEMPORARY_UNAVAILABLE'
        )
      } finally {
        clearTimeout(timeout)
      }
    },
    async loadVerseSections(publicationIds, language, verseKey) {
      if (!(await isOnline())) throw new ResourceAccessError('NETWORK_OFFLINE')
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), timeoutMs)
      try {
        const query = new URLSearchParams({ language, commentaries: publicationIds.join(',') })
        const response = await fetcher(
          `${normalizedBaseUrl}/v1/commentaries/verses/${encodeURIComponent(verseKey)}/sections?${query}`,
          { headers: { accept: 'application/json' }, signal: controller.signal }
        )
        const payload: unknown = await response.json().catch(() => undefined)
        if (!response.ok) {
          const code =
            payload && typeof payload === 'object' && 'code' in payload ? payload.code : undefined
          throw resourceAccessErrorFromHttpResponse('TEMPORARY_UNAVAILABLE', response, code)
        }
        let decoded: Schema.Schema.Type<typeof CommentaryVerseSectionsResponseDto>
        try {
          decoded = Schema.decodeUnknownSync(CommentaryVerseSectionsResponseDto)(payload)
        } catch {
          throw new ResourceAccessError('INTEGRITY_FAILURE')
        }
        if (decoded.verseKey !== verseKey) throw new ResourceAccessError('INTEGRITY_FAILURE')
        return decoded.sections.flatMap(section =>
          section.resource.language === language &&
          publicationIds.includes(section.resource.resourceId)
            ? [
                {
                  publicationId: section.resource.resourceId,
                  startVerse: section.startVerse,
                  endVerse: section.endVerse,
                  content: section.content,
                },
              ]
            : []
        )
      } catch (error) {
        if (error instanceof ResourceAccessError) throw error
        throw new ResourceAccessError(
          (await isOfflineFailure()) ? 'NETWORK_OFFLINE' : 'TEMPORARY_UNAVAILABLE'
        )
      } finally {
        clearTimeout(timeout)
      }
    },
    async loadResourceCoverage(publicationId, language) {
      if (!(await isOnline())) throw new ResourceAccessError('NETWORK_OFFLINE')
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), timeoutMs)
      try {
        const response = await fetcher(
          `${normalizedBaseUrl}/v1/commentaries/${encodeURIComponent(publicationId)}/${language}/coverage`,
          { headers: { accept: 'application/json' }, signal: controller.signal }
        )
        const payload: unknown = await response.json().catch(() => undefined)
        if (!response.ok) {
          const code =
            payload && typeof payload === 'object' && 'code' in payload ? payload.code : undefined
          throw resourceAccessErrorFromHttpResponse('TEMPORARY_UNAVAILABLE', response, code)
        }

        let decoded: Schema.Schema.Type<typeof CommentaryCoverageResponseDto>
        try {
          decoded = Schema.decodeUnknownSync(CommentaryCoverageResponseDto)(payload)
        } catch {
          throw new ResourceAccessError('INTEGRITY_FAILURE')
        }
        if (
          decoded.resource.resourceId !== publicationId ||
          decoded.resource.language !== language
        ) {
          throw new ResourceAccessError('INTEGRITY_FAILURE')
        }
        return {
          books: [...decoded.books],
          chaptersByBook: Object.fromEntries(
            Object.entries(decoded.chaptersByBook).map(([book, chapters]) => [
              Number(book),
              [...chapters],
            ])
          ),
        }
      } catch (error) {
        if (error instanceof ResourceAccessError) throw error
        throw new ResourceAccessError(
          (await isOfflineFailure()) ? 'NETWORK_OFFLINE' : 'TEMPORARY_UNAVAILABLE'
        )
      } finally {
        clearTimeout(timeout)
      }
    },
  }
}

const toUnavailableCause = (error: unknown): CommentaryUnavailableResource['cause'] => {
  if (error instanceof ResourceAccessError) {
    if (error.code === 'INVALID_OFFLINE_COPY' || error.code === 'INTEGRITY_FAILURE') {
      return 'invalid-offline-copy'
    }
    if (error.code === 'OFFLINE_COPY_REQUIRED' || error.code === 'NETWORK_OFFLINE') {
      return 'offline-copy-required'
    }
  }
  return 'temporary-unavailable'
}

const toComment = ({
  section,
  matchingSectionCount,
  resourceId,
  language,
  verseId,
  order,
}: {
  section: CommentaryResourceSection
  matchingSectionCount: number
  resourceId: string
  language: ResourceLanguage
  verseId: string
  order: number
}): Comment => {
  const entry = COMMENTARY_CATALOG_BY_ID.get(resourceId)!
  return {
    id: `${entry.publicationId}-${language}-${verseId}`,
    sectionId: section.id,
    verseId,
    rangeStartVerse: section.rangeStartVerse,
    rangeEndVerse: section.rangeEndVerse,
    matchingSectionCount,
    content: section.preview,
    resource: {
      name: entry.title,
      code: `${entry.publicationId}:${language}`,
      shortName: entry.shortName,
      logo: '',
      author: entry.author,
    },
    order,
    type: 'comment',
    isSDA: entry.id === 'sdabc',
  }
}

const getCommentarySectionsByVerse = (sections: readonly CommentaryResourceSection[]) => {
  const result = new Map<number, CommentaryResourceSection[]>()
  for (const section of sections) {
    for (let verse = section.rangeStartVerse; verse <= section.rangeEndVerse; verse += 1) {
      const matchingSections = result.get(verse) ?? []
      matchingSections.push(section)
      result.set(verse, matchingSections)
    }
  }
  return result
}

export const createCommentaryAccess = ({
  local: localSource = localCommentaryChapterSource,
  remote: remoteSource,
  isOnline,
}: {
  local?: CommentaryChapterSource
  remote?: CommentaryChapterSource
  isOnline: () => Promise<boolean>
}): CommentaryAccess => {
  const local = withResourceSourceLogging(localSource, {
    resource: 'Commentary',
    source: 'offline',
  })
  const remote = remoteSource
    ? withResourceSourceLogging(remoteSource, { resource: 'Commentary', source: 'online' })
    : undefined
  const loadResourceComments = async ({
    resourceId,
    language,
    book,
    chapter,
  }: CommentaryResourceSelection & { book: number; chapter: number }) => {
    const entry = COMMENTARY_CATALOG_BY_ID.get(resourceId)
    if (!entry?.languages.includes(language)) throw new ResourceAccessError('RESOURCE_UNSUPPORTED')

    try {
      return {
        entry,
        comments: await local.loadResourceChapter(entry.publicationId, language, book, chapter),
      }
    } catch (localError) {
      if (!(await isOnline()) || !remote) throw localError
      return {
        entry,
        comments: await remote.loadResourceChapter(entry.publicationId, language, book, chapter),
      }
    }
  }

  return {
    async loadChapter({ book, chapter, resources }) {
      if (
        !Number.isSafeInteger(book) ||
        book < 1 ||
        !Number.isSafeInteger(chapter) ||
        chapter < 0
      ) {
        throw new ResourceAccessError('NOT_FOUND')
      }

      const selectedEntries = resources.map(({ resourceId, language }) => {
        const entry = COMMENTARY_CATALOG_BY_ID.get(resourceId)
        if (!entry?.languages.includes(language))
          throw new ResourceAccessError('RESOURCE_UNSUPPORTED')
        return { entry, language }
      })
      const connected = await isOnline()
      const outcomes = await Promise.all(
        selectedEntries.map(async selection => {
          const { entry, language } = selection
          try {
            const comments = await local.loadResourceChapter(
              entry.publicationId,
              language,
              book,
              chapter
            )
            return { entry, language, comments } as const
          } catch (localError) {
            if (!connected || !remote) return { entry, language, error: localError } as const
            try {
              const comments = await remote.loadResourceChapter(
                entry.publicationId,
                language,
                book,
                chapter
              )
              return { entry, language, comments } as const
            } catch (remoteError) {
              return { entry, language, error: remoteError } as const
            }
          }
        })
      )

      const commentsByVerse: Record<string, Comment[]> = {}
      const unavailableResources: CommentaryUnavailableResource[] = []
      outcomes.forEach((outcome, order) => {
        if ('error' in outcome) {
          unavailableResources.push({
            resourceId: outcome.entry.id,
            language: outcome.language,
            cause: toUnavailableCause(outcome.error),
          })
          return
        }
        const sections = buildCommentaryResourceSections({
          entry: outcome.entry,
          language: outcome.language,
          book,
          chapter,
          comments: outcome.comments,
        })
        const sectionsByVerse = getCommentarySectionsByVerse(sections)
        for (const [verse, content] of Object.entries(outcome.comments)) {
          const verseId = `${book}-${chapter}-${verse}`
          const verseNumber = Number(verse)
          const matchingSections = sectionsByVerse.get(verseNumber) ?? []
          const section = matchingSections[0] ?? {
            id: createCommentarySectionId(
              outcome.entry.publicationId,
              outcome.language,
              book,
              chapter,
              verseNumber,
              verseNumber
            ),
            rangeStartVerse: verseNumber,
            rangeEndVerse: verseNumber,
            preview: createCommentaryPreview(content),
            content,
          }
          commentsByVerse[verse] ??= []
          commentsByVerse[verse].push(
            toComment({
              section,
              matchingSectionCount: Math.max(1, matchingSections.length),
              resourceId: outcome.entry.id,
              language: outcome.language,
              verseId,
              order,
            })
          )
        }
      })

      return { book, chapter, commentsByVerse, unavailableResources }
    },
    async loadVerseExcerpts({ verseKey, resources }) {
      const [book, chapter, verse] = verseKey.split('-').map(Number)
      if (![book, chapter, verse].every(value => Number.isSafeInteger(value) && value > 0)) {
        throw new ResourceAccessError('NOT_FOUND')
      }
      const entries = resources.flatMap(({ resourceId, language }) => {
        const entry = COMMENTARY_CATALOG_BY_ID.get(resourceId)
        return entry?.languages.includes(language) ? [{ entry, language }] : []
      })
      const excerpts = new Map<string, CommentaryVerseExcerpt>()
      const remaining: typeof entries = []
      // An offline copy answers from its chapter, with the same sections the commentary shows.
      await Promise.all(
        entries.map(async selection => {
          const { entry, language } = selection
          try {
            const comments = await local.loadResourceChapter(
              entry.publicationId,
              language,
              book,
              chapter
            )
            const closest = buildCommentaryResourceSections({
              entry,
              language,
              book,
              chapter,
              comments,
            })
              .filter(
                section =>
                  section.rangeEndVerse > 0 &&
                  section.rangeStartVerse <= verse &&
                  verse <= section.rangeEndVerse
              )
              .sort(
                (left, right) =>
                  left.rangeEndVerse -
                  left.rangeStartVerse -
                  (right.rangeEndVerse - right.rangeStartVerse)
              )[0]
            if (closest) {
              excerpts.set(`${entry.id}:${language}`, {
                resourceId: entry.id,
                language,
                title: entry.title,
                rangeStartVerse: closest.rangeStartVerse,
                rangeEndVerse: closest.rangeEndVerse,
                preview: closest.preview,
              })
            }
          } catch {
            remaining.push(selection)
          }
        })
      )
      if (remaining.length && remote?.loadVerseSections && (await isOnline())) {
        const languages = [...new Set(remaining.map(({ language }) => language))]
        await Promise.all(
          languages.map(async language => {
            const asked = remaining.filter(selection => selection.language === language)
            const sections = await remote.loadVerseSections!(
              asked.map(({ entry }) => entry.publicationId),
              language,
              verseKey
            ).catch(() => [])
            for (const section of sections) {
              const selection = asked.find(
                ({ entry }) => entry.publicationId === section.publicationId
              )
              if (!selection || section.endVerse < 1) continue
              excerpts.set(`${selection.entry.id}:${language}`, {
                resourceId: selection.entry.id,
                language,
                title: selection.entry.title,
                rangeStartVerse: Math.max(1, section.startVerse),
                rangeEndVerse: section.endVerse,
                preview: createCommentaryPreview(section.content),
              })
            }
          })
        )
      }
      return entries.flatMap(({ entry, language }) => excerpts.get(`${entry.id}:${language}`) ?? [])
    },
    async loadResourceChapter({ resourceId, language, book, chapter }) {
      if (
        !Number.isSafeInteger(book) ||
        book < 1 ||
        !Number.isSafeInteger(chapter) ||
        chapter < 1
      ) {
        throw new ResourceAccessError('NOT_FOUND')
      }

      const { entry, comments } = await loadResourceComments({
        resourceId,
        language,
        book,
        chapter,
      })
      const sections = buildCommentaryResourceSections({
        entry,
        language,
        book,
        chapter,
        comments,
      })

      return { resourceId, language, book, chapter, sections }
    },
    async loadResourceCoverage({ resourceId, language }) {
      const entry = COMMENTARY_CATALOG_BY_ID.get(resourceId)
      if (!entry?.languages.includes(language)) {
        throw new ResourceAccessError('RESOURCE_UNSUPPORTED')
      }
      try {
        const coverage = await local.loadResourceCoverage(entry.publicationId, language)
        return { resourceId, language, ...coverage }
      } catch (localError) {
        if (!(await isOnline()) || !remote) throw localError
        const coverage = await remote.loadResourceCoverage(entry.publicationId, language)
        return { resourceId, language, ...coverage }
      }
    },
  }
}

export const localOnlyCommentaryAccess = createCommentaryAccess({
  isOnline: async () => false,
})
