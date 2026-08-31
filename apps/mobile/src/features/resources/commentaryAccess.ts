import { COMMENTARY_CATALOG_BY_ID } from '@bible-strong/resource-catalog/commentaries'
import { Schema } from 'effect'
import * as FileSystem from 'expo-file-system/legacy'
import { DomUtils, parseDocument } from 'htmlparser2'

import type { Comment } from '~features/commentaries/types'
import { getCommentaryDbPath } from '~helpers/databases'
import type { ResourceLanguage } from '~helpers/databaseTypes'
import { openSQLiteDatabase } from '~helpers/sqlite'
import {
  CommentaryChapterResponseDto,
  CommentaryCoverageResponseDto,
} from './supplementaryContract'
import { ResourceAccessError, resourceAccessErrorFromHttpResponse } from './resourceAccessError'

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

export type CommentaryResourceSection = {
  id: string
  rangeStartVerse: number
  rangeEndVerse: number
  title?: string
  preview: string
  content: string
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

export type CommentaryAccess = {
  loadChapter: (request: CommentaryChapterRequest) => Promise<CommentaryChapter>
  loadResourceChapter: (
    request: CommentaryResourceSelection & { book: number; chapter: number }
  ) => Promise<CommentaryResourceChapter>
  loadResourceCoverage: (
    request: CommentaryResourceSelection
  ) => Promise<CommentaryResourceCoverage>
}

type SerializedCommentaryChapter = Record<string, string>

const COMMENTARY_PREVIEW_MAX_CHARACTERS = 1_200

const createCommentaryPreview = (html: string) =>
  DomUtils.textContent(parseDocument(html))
    .replace(/\s+/gu, ' ')
    .trim()
    .slice(0, COMMENTARY_PREVIEW_MAX_CHARACTERS)
    .trimEnd()

const createCommentarySectionTitle = (html: string) => {
  const match = html.match(/<(?:h[1-6]|strong|b)\b[^>]*>([\s\S]*?)<\/(?:h[1-6]|strong|b)>/iu)
  if (!match?.[1]) return undefined
  const title = DomUtils.textContent(parseDocument(match[1])).replace(/\s+/gu, ' ').trim()
  return title.length > 0 && title.length <= 140 ? title : undefined
}

const createCommentarySectionId = (
  publicationId: string,
  language: ResourceLanguage,
  book: number,
  chapter: number,
  start: number,
  end: number
) => `${publicationId}-${language}-${book}-${chapter}-${start}-${end}`

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

export const localCommentaryChapterSource: CommentaryChapterSource = {
  async loadResourceChapter(publicationId, language, book, chapter) {
    const path = getCommentaryDbPath(publicationId, language)
    const info = await FileSystem.getInfoAsync(path)
    if (!info.exists || info.isDirectory) {
      throw new ResourceAccessError('OFFLINE_COPY_REQUIRED', ['acquire-offline-copy'])
    }

    const fileName = path.split('/').pop()!
    const directory = path.slice(0, -(fileName.length + 1))
    let database: Awaited<ReturnType<typeof openSQLiteDatabase>> | undefined
    try {
      database = await openSQLiteDatabase(fileName, { useNewConnection: true }, directory)
      const row = await database.getFirstAsync<{ commentaires: string }>(
        'SELECT commentaires FROM COMMENTAIRES WHERE id = ?',
        `${book}-${chapter}`
      )
      return row ? decodeSerializedComments(row.commentaires) : {}
    } catch (error) {
      if (error instanceof ResourceAccessError) throw error
      throw new ResourceAccessError('INVALID_OFFLINE_COPY', [
        'acquire-offline-copy',
        'manage-offline-copies',
      ])
    } finally {
      await database?.closeAsync()
    }
  },
  async loadResourceCoverage(publicationId, language) {
    const path = getCommentaryDbPath(publicationId, language)
    const info = await FileSystem.getInfoAsync(path)
    if (!info.exists || info.isDirectory) {
      throw new ResourceAccessError('OFFLINE_COPY_REQUIRED', ['acquire-offline-copy'])
    }

    const fileName = path.split('/').pop()!
    const directory = path.slice(0, -(fileName.length + 1))
    let database: Awaited<ReturnType<typeof openSQLiteDatabase>> | undefined
    try {
      database = await openSQLiteDatabase(fileName, { useNewConnection: true }, directory)
      const rows = await database.getAllAsync<{ id: string }>('SELECT id FROM COMMENTAIRES')
      return buildCommentaryCoverage(rows.map(row => row.id))
    } catch (error) {
      if (error instanceof ResourceAccessError) throw error
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
  timeoutMs?: number
}

export const createHttpCommentaryChapterSource = ({
  baseUrl,
  fetcher = fetch,
  isOnline,
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
          (await isOnline()) ? 'TEMPORARY_UNAVAILABLE' : 'NETWORK_OFFLINE'
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
          (await isOnline()) ? 'TEMPORARY_UNAVAILABLE' : 'NETWORK_OFFLINE'
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
  content,
  resourceId,
  language,
  verseId,
  rangeStartVerse,
  rangeEndVerse,
  order,
}: {
  content: string
  resourceId: string
  language: ResourceLanguage
  verseId: string
  rangeStartVerse: number
  rangeEndVerse: number
  order: number
}): Comment => {
  const entry = COMMENTARY_CATALOG_BY_ID.get(resourceId)!
  const sectionId = createCommentarySectionId(
    entry.publicationId,
    language,
    Number(verseId.split('-')[0]),
    Number(verseId.split('-')[1]),
    rangeStartVerse,
    rangeEndVerse
  )
  return {
    id: `${entry.publicationId}-${language}-${verseId}`,
    sectionId,
    verseId,
    rangeStartVerse,
    rangeEndVerse,
    content: createCommentaryPreview(content),
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

const getContentRangesByVerse = (comments: SerializedCommentaryChapter) => {
  const ranges = new Map<number, { start: number; end: number }>()
  const entries = Object.entries(comments)
    .map(([verse, content]) => ({ verse: Number(verse), content }))
    .sort((left, right) => left.verse - right.verse)

  for (let index = 0; index < entries.length; ) {
    const first = entries[index]
    let endIndex = index
    while (
      endIndex + 1 < entries.length &&
      entries[endIndex + 1].verse === entries[endIndex].verse + 1 &&
      entries[endIndex + 1].content === first.content
    ) {
      endIndex += 1
    }
    const range = { start: first.verse, end: entries[endIndex].verse }
    for (let position = index; position <= endIndex; position += 1) {
      ranges.set(entries[position].verse, range)
    }
    index = endIndex + 1
  }

  return ranges
}

const splitCommentarySections = (content: string) =>
  content
    .split(/<hr\b[^>]*\/?\s*>/giu)
    .map(section => section.trim())
    .filter(Boolean)

const getCommentarySectionRuns = (comments: SerializedCommentaryChapter) => {
  const occurrencesByContent = new Map<string, { verse: number; fragmentIndex: number }[]>()

  for (const [verseKey, content] of Object.entries(comments).sort(
    ([left], [right]) => Number(left) - Number(right)
  )) {
    const verse = Number(verseKey)
    splitCommentarySections(content).forEach((fragment, fragmentIndex) => {
      const occurrences = occurrencesByContent.get(fragment) ?? []
      if (!occurrences.some(candidate => candidate.verse === verse)) {
        occurrences.push({ verse, fragmentIndex })
      }
      occurrencesByContent.set(fragment, occurrences)
    })
  }

  const runs: {
    start: number
    end: number
    fragmentIndex: number
    content: string
  }[] = []
  for (const [content, occurrences] of occurrencesByContent) {
    for (let index = 0; index < occurrences.length; ) {
      const first = occurrences[index]
      let endIndex = index
      while (
        endIndex + 1 < occurrences.length &&
        occurrences[endIndex + 1].verse === occurrences[endIndex].verse + 1
      ) {
        endIndex += 1
      }
      runs.push({
        start: first.verse,
        end: occurrences[endIndex].verse,
        fragmentIndex: first.fragmentIndex,
        content,
      })
      index = endIndex + 1
    }
  }

  return runs.sort(
    (left, right) =>
      left.start - right.start || left.fragmentIndex - right.fragmentIndex || left.end - right.end
  )
}

export const createCommentaryAccess = ({
  local = localCommentaryChapterSource,
  remote,
  isOnline,
}: {
  local?: CommentaryChapterSource
  remote?: CommentaryChapterSource
  isOnline: () => Promise<boolean>
}): CommentaryAccess => {
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
        const rangesByVerse = getContentRangesByVerse(outcome.comments)
        for (const [verse, content] of Object.entries(outcome.comments)) {
          const verseId = `${book}-${chapter}-${verse}`
          const verseNumber = Number(verse)
          const range = rangesByVerse.get(verseNumber) ?? {
            start: verseNumber,
            end: verseNumber,
          }
          commentsByVerse[verse] ??= []
          commentsByVerse[verse].push(
            toComment({
              content,
              resourceId: outcome.entry.id,
              language: outcome.language,
              verseId,
              rangeStartVerse: range.start,
              rangeEndVerse: range.end,
              order,
            })
          )
        }
      })

      return { book, chapter, commentsByVerse, unavailableResources }
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
      const sections: CommentaryResourceSection[] = []
      const sectionIdOccurrences = new Map<string, number>()
      for (const { start, end, content } of getCommentarySectionRuns(comments)) {
        const baseId = createCommentarySectionId(
          entry.publicationId,
          language,
          book,
          chapter,
          start,
          end
        )
        const idOccurrence = sectionIdOccurrences.get(baseId) ?? 0
        sectionIdOccurrences.set(baseId, idOccurrence + 1)
        sections.push({
          id: idOccurrence === 0 ? baseId : `${baseId}-${idOccurrence + 1}`,
          rangeStartVerse: start,
          rangeEndVerse: end,
          title: createCommentarySectionTitle(content),
          preview: createCommentaryPreview(content),
          content,
        })
      }

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
