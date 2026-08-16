import { Schema } from 'effect'

import type { Verse } from '~common/types'
import type { BibleVersionCoverage } from '~helpers/biblesDb'
import type { BibleRecoveryAction } from '~helpers/bibleErrors'
import { BibleChapterDto, BibleVersionCoverageDto } from './bibleChapterContract'

export type BibleChapterUnavailableReason =
  | 'publication-not-available'
  | 'chapter-not-available'
  | 'offline-copy-invalid'
  | 'resource-unsupported'
  | 'network-offline'
  | 'temporary-unavailable'
  | 'integrity-failure'

export type BibleChapterSourceResult =
  | { status: 'available'; verses: Verse[] }
  | {
      status: 'unavailable'
      reason: BibleChapterUnavailableReason
      recoveries?: BibleRecoveryAction[]
    }

export type BibleChapterAdapter = {
  loadChapter: (version: string, book: number, chapter: number) => Promise<BibleChapterSourceResult>
  loadCoverage: (version: string) => Promise<BibleCoverageSourceResult>
}

export type BibleCoverageSourceResult =
  | { status: 'available'; coverage: BibleVersionCoverage }
  | { status: 'unavailable'; reason: BibleChapterUnavailableReason }

export class BibleVerseTextSourceError extends Error {
  constructor(
    public readonly reason: BibleChapterUnavailableReason,
    public readonly recoveries?: BibleRecoveryAction[]
  ) {
    super(reason)
    this.name = 'BibleVerseTextSourceError'
  }
}

export const loadVerseTextsFromChapterAdapter = async (
  adapter: BibleChapterAdapter,
  version: string,
  verseKeys: string[],
  shouldCancel?: () => boolean
): Promise<Record<string, string>> => {
  const chapters = new Map<string, { book: number; chapter: number; verseKeys: string[] }>()

  for (const verseKey of verseKeys) {
    const parts = verseKey.split('-').map(Number)
    const [book, chapter, verse] = parts
    if (
      parts.length !== 3 ||
      !Number.isInteger(book) ||
      !Number.isInteger(chapter) ||
      !Number.isInteger(verse) ||
      book < 1 ||
      chapter < 1 ||
      verse < 1
    ) {
      continue
    }
    const chapterKey = `${book}-${chapter}`
    const group = chapters.get(chapterKey) ?? { book, chapter, verseKeys: [] }
    group.verseKeys.push(verseKey)
    chapters.set(chapterKey, group)
  }

  const result: Record<string, string> = {}
  let firstUnavailable: Extract<BibleChapterSourceResult, { status: 'unavailable' }> | undefined
  for (const group of chapters.values()) {
    if (shouldCancel?.()) return result
    const chapterResult = await adapter.loadChapter(version, group.book, group.chapter)
    if (chapterResult.status !== 'available') {
      firstUnavailable ??= chapterResult
      continue
    }

    const requestedKeys = new Set(group.verseKeys)
    for (const verse of chapterResult.verses) {
      const verseKey = `${verse.Livre}-${verse.Chapitre}-${verse.Verset}`
      if (requestedKeys.has(verseKey)) result[verseKey] = verse.Texte
    }
  }

  if (Object.keys(result).length === 0 && firstUnavailable) {
    throw new BibleVerseTextSourceError(firstUnavailable.reason, firstUnavailable.recoveries)
  }

  return result
}

export const createHybridBibleChapterAdapter = ({
  offline,
  online,
}: {
  offline: BibleChapterAdapter
  online: BibleChapterAdapter
}): BibleChapterAdapter => ({
  async loadChapter(version, book, chapter) {
    const local = await offline.loadChapter(version, book, chapter)
    if (local.status === 'available' || local.reason === 'chapter-not-available') return local

    const remote = await online.loadChapter(version, book, chapter)
    if (remote.status === 'available') return remote
    if (remote.reason === 'chapter-not-available') return remote
    if (local.reason === 'offline-copy-invalid') {
      return {
        status: 'unavailable',
        reason: 'offline-copy-invalid',
        recoveries: ['manage-offline-copies', 'reset-offline-store'],
      }
    }
    if (remote.reason === 'resource-unsupported') return remote
    return remote
  },
  async loadCoverage(version) {
    const local = await offline.loadCoverage(version)
    if (local.status === 'available' && local.coverage.books.length > 0) return local
    const remote = await online.loadCoverage(version)
    if (remote.status === 'available') return remote
    return local.status === 'unavailable' && local.reason === 'offline-copy-invalid'
      ? local
      : remote
  },
})

type HttpBibleChapterAdapterOptions = {
  baseUrl: string
  fetcher?: typeof fetch
  isOnline: () => Promise<boolean>
  timeoutMs?: number
}

const normalizeBaseUrl = (value: string) => value.replace(/\/+$/, '')

export const getConfiguredResourceApiBaseUrl = (value: string | undefined): string | undefined => {
  if (!value) return undefined
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
      ? normalizeBaseUrl(url.toString())
      : undefined
  } catch {
    return undefined
  }
}

export const getDevelopmentResourceApiBaseUrl = (
  platform: 'ios' | 'android' | 'web'
): string | undefined => {
  if (platform === 'ios') return 'http://127.0.0.1:8787'
  if (platform === 'android') return 'http://10.0.2.2:8787'
  return undefined
}

const problemReason = (status: number, code: unknown): BibleChapterUnavailableReason => {
  if (status === 404 && code === 'BIBLE_CHAPTER_NOT_FOUND') return 'chapter-not-available'
  if (status === 404 && code === 'BIBLE_UNSUPPORTED') return 'resource-unsupported'
  return 'temporary-unavailable'
}

const toVerse = (
  book: number,
  chapter: number,
  revision: string,
  verse: BibleChapterDto['verses'][number]
): Verse => ({
  Livre: book,
  Chapitre: chapter,
  Verset: verse.number,
  Texte: verse.text,
  TextRevision: revision,
  StartTags: verse.presentation.startTags.map(tag => ({
    ...tag,
    ...(tag.attributes ? { attributes: { ...tag.attributes } } : {}),
  })),
  Layout: verse.presentation.layout.map(event => ({
    ...event,
    ...(event.attributes ? { attributes: { ...event.attributes } } : {}),
  })),
  Notes: verse.presentation.notes.map(note => ({ ...note })),
  Headings: verse.presentation.headings.map(heading => ({
    ...heading,
    ...(heading.attributes ? { attributes: { ...heading.attributes } } : {}),
  })),
})

export const createHttpBibleChapterAdapter = ({
  baseUrl,
  fetcher = fetch,
  isOnline,
  timeoutMs = 10_000,
}: HttpBibleChapterAdapterOptions): BibleChapterAdapter => {
  const normalizedBaseUrl = normalizeBaseUrl(baseUrl)

  return {
    async loadChapter(version, book, chapter) {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), timeoutMs)
      try {
        const response = await fetcher(
          `${normalizedBaseUrl}/v1/bibles/${encodeURIComponent(version)}/books/${book}/chapters/${chapter}`,
          { headers: { accept: 'application/json' }, signal: controller.signal }
        )
        const payload: unknown = await response.json().catch(() => undefined)
        if (!response.ok) {
          const code =
            payload && typeof payload === 'object' && 'code' in payload ? payload.code : undefined
          return { status: 'unavailable', reason: problemReason(response.status, code) }
        }
        try {
          const decoded = Schema.decodeUnknownSync(BibleChapterDto)(payload)
          return {
            status: 'available',
            verses: decoded.verses.map(verse =>
              toVerse(decoded.book, decoded.chapter, decoded.resource.revision, verse)
            ),
          }
        } catch {
          return { status: 'unavailable', reason: 'integrity-failure' }
        }
      } catch {
        return {
          status: 'unavailable',
          reason: (await isOnline()) ? 'temporary-unavailable' : 'network-offline',
        }
      } finally {
        clearTimeout(timeout)
      }
    },
    async loadCoverage(version) {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), timeoutMs)
      try {
        const response = await fetcher(
          `${normalizedBaseUrl}/v1/bibles/${encodeURIComponent(version)}/coverage`,
          { headers: { accept: 'application/json' }, signal: controller.signal }
        )
        const payload: unknown = await response.json().catch(() => undefined)
        if (!response.ok) {
          const code =
            payload && typeof payload === 'object' && 'code' in payload ? payload.code : undefined
          return { status: 'unavailable', reason: problemReason(response.status, code) }
        }
        try {
          const decoded = Schema.decodeUnknownSync(BibleVersionCoverageDto)(payload)
          return {
            status: 'available',
            coverage: {
              books: [...decoded.books],
              chaptersByBook: Object.fromEntries(
                Object.entries(decoded.chaptersByBook).map(([book, chapters]) => [
                  Number(book),
                  [...chapters],
                ])
              ),
              verseCountByBookChapter: { ...decoded.verseCountByBookChapter },
            },
          }
        } catch {
          return { status: 'unavailable', reason: 'integrity-failure' }
        }
      } catch {
        return {
          status: 'unavailable',
          reason: (await isOnline()) ? 'temporary-unavailable' : 'network-offline',
        }
      } finally {
        clearTimeout(timeout)
      }
    },
  }
}

export const unavailableHttpBibleChapterAdapter: BibleChapterAdapter = {
  loadChapter: async () => ({ status: 'unavailable', reason: 'resource-unsupported' }),
  loadCoverage: async () => ({ status: 'unavailable', reason: 'resource-unsupported' }),
}
