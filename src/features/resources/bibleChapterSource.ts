import { Schema } from 'effect'

import type { Verse } from '~common/types'
import type { BibleVersionCoverage } from '~helpers/biblesDb'
import type { BibleRecoveryAction } from '~helpers/bibleErrors'
import {
  BibleChapterDto,
  BibleVerseTextsDto,
  BibleVersionCoverageDto,
  parseBibleVerseKey,
} from './bibleChapterContract'

export type BibleChapterUnavailableReason =
  | 'publication-not-available'
  | 'chapter-not-available'
  | 'verses-not-available'
  | 'offline-copy-invalid'
  | 'resource-unsupported'
  | 'network-offline'
  | 'temporary-unavailable'
  | 'integrity-failure'

export type BibleChapterSourceResult =
  | {
      status: 'available'
      verses: Verse[]
      presentation?: 'canonical' | 'legacy-sidecars'
      textRevision?: string
      textSha256?: string
    }
  | {
      status: 'unavailable'
      reason: BibleChapterUnavailableReason
      recoveries?: BibleRecoveryAction[]
    }

export type BibleChapterAdapter = {
  loadChapter: (version: string, book: number, chapter: number) => Promise<BibleChapterSourceResult>
  loadCoverage: (version: string) => Promise<BibleCoverageSourceResult>
  loadVerseTexts?: (
    version: string,
    verseKeys: string[],
    shouldCancel?: () => boolean
  ) => Promise<BibleVerseTextsSourceResult>
}

export type BibleVerseTextsSourceResult =
  | {
      status: 'available'
      texts: Record<string, string>
      textRevision?: string
      textSha256?: string
    }
  | {
      status: 'unavailable'
      reason: BibleChapterUnavailableReason
      recoveries?: BibleRecoveryAction[]
    }

export type BibleCoverageSourceResult =
  | {
      status: 'available'
      coverage: BibleVersionCoverage
      textRevision?: string
      textSha256?: string
    }
  | { status: 'unavailable'; reason: BibleChapterUnavailableReason }

export const isUsableBibleCoverage = (result: BibleCoverageSourceResult) =>
  result.status === 'available' && result.coverage.books.length > 0

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
  shouldCancel?: () => boolean,
  expectedTextRevision?: string,
  expectedTextSha256?: string
): Promise<Record<string, string>> => {
  if (adapter.loadVerseTexts) {
    const selection = await adapter.loadVerseTexts(version, verseKeys, shouldCancel)
    if (selection.status === 'unavailable') {
      throw new BibleVerseTextSourceError(selection.reason, selection.recoveries)
    }
    if (
      (expectedTextRevision !== undefined && selection.textRevision !== expectedTextRevision) ||
      (expectedTextSha256 !== undefined && selection.textSha256 !== expectedTextSha256)
    ) {
      throw new BibleVerseTextSourceError('integrity-failure')
    }
    return selection.texts
  }

  const chapters = new Map<string, { book: number; chapter: number; verseKeys: string[] }>()

  for (const verseKey of verseKeys) {
    const location = parseBibleVerseKey(verseKey)
    if (!location) continue
    const { book, chapter } = location
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
    if (
      (expectedTextRevision !== undefined && chapterResult.textRevision !== expectedTextRevision) ||
      (expectedTextSha256 !== undefined && chapterResult.textSha256 !== expectedTextSha256)
    ) {
      throw new BibleVerseTextSourceError('integrity-failure')
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
  async loadVerseTexts(version, verseKeys, shouldCancel) {
    const local = offline.loadVerseTexts
      ? await offline.loadVerseTexts(version, verseKeys, shouldCancel)
      : undefined
    if (local?.status === 'available' || local?.reason === 'verses-not-available') return local

    const remote = online.loadVerseTexts
      ? await online.loadVerseTexts(version, verseKeys, shouldCancel)
      : undefined
    if (remote?.status === 'available' || remote?.reason === 'verses-not-available') return remote
    if (local?.reason === 'offline-copy-invalid') {
      return {
        status: 'unavailable',
        reason: 'offline-copy-invalid',
        recoveries: ['manage-offline-copies', 'reset-offline-store'],
      }
    }
    return remote ?? local ?? { status: 'unavailable', reason: 'resource-unsupported' }
  },
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
    if (isUsableBibleCoverage(local)) return local
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
  if (status === 404 && code === 'BIBLE_VERSES_NOT_FOUND') return 'verses-not-available'
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
  const requestResource = async <Value>(
    path: string,
    decode: (payload: unknown) => Value
  ): Promise<
    | { status: 'success'; value: Value }
    | { status: 'unavailable'; reason: BibleChapterUnavailableReason }
  > => {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const response = await fetcher(`${normalizedBaseUrl}${path}`, {
        headers: { accept: 'application/json' },
        signal: controller.signal,
      })
      const payload: unknown = await response.json().catch(() => undefined)
      if (!response.ok) {
        const code =
          payload && typeof payload === 'object' && 'code' in payload ? payload.code : undefined
        return { status: 'unavailable', reason: problemReason(response.status, code) }
      }
      try {
        return { status: 'success', value: decode(payload) }
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
  }

  return {
    async loadVerseTexts(version, verseKeys, shouldCancel) {
      const references = [...new Set(verseKeys.filter(key => parseBibleVerseKey(key)))]
      if (!references.length || shouldCancel?.()) return { status: 'available', texts: {} }

      const texts: Record<string, string> = {}
      let textRevision: string | undefined
      let textSha256: string | undefined
      for (let offset = 0; offset < references.length; offset += 200) {
        if (shouldCancel?.()) return { status: 'available', texts: {} }
        const batch = references.slice(offset, offset + 200)
        const result = await requestResource(
          `/v1/bibles/${encodeURIComponent(version)}/verses?references=${batch.join(',')}`,
          Schema.decodeUnknownSync(BibleVerseTextsDto)
        )
        if (result.status === 'unavailable') return result
        const decoded = result.value
        const revision = decoded.resource.textRevision ?? decoded.resource.revision
        if (
          (textRevision !== undefined && revision !== textRevision) ||
          (textSha256 !== undefined && decoded.resource.textSha256 !== textSha256)
        ) {
          return { status: 'unavailable', reason: 'integrity-failure' }
        }
        textRevision = revision
        textSha256 = decoded.resource.textSha256
        for (const verse of decoded.verses) {
          texts[`${verse.book}-${verse.chapter}-${verse.number}`] = verse.text
        }
      }
      return { status: 'available', texts, textRevision, textSha256 }
    },
    async loadChapter(version, book, chapter) {
      const result = await requestResource(
        `/v1/bibles/${encodeURIComponent(version)}/books/${book}/chapters/${chapter}`,
        Schema.decodeUnknownSync(BibleChapterDto)
      )
      if (result.status === 'unavailable') return result
      const decoded = result.value
      return {
        status: 'available',
        presentation: 'canonical',
        textRevision: decoded.resource.textRevision ?? decoded.resource.revision,
        ...(decoded.resource.textSha256 ? { textSha256: decoded.resource.textSha256 } : {}),
        verses: decoded.verses.map(verse =>
          toVerse(
            decoded.book,
            decoded.chapter,
            decoded.resource.textRevision ?? decoded.resource.revision,
            verse
          )
        ),
      }
    },
    async loadCoverage(version) {
      const result = await requestResource(
        `/v1/bibles/${encodeURIComponent(version)}/coverage`,
        Schema.decodeUnknownSync(BibleVersionCoverageDto)
      )
      if (result.status === 'unavailable') return result
      const decoded = result.value
      return {
        status: 'available',
        textRevision: decoded.resource.textRevision ?? decoded.resource.revision,
        ...(decoded.resource.textSha256 ? { textSha256: decoded.resource.textSha256 } : {}),
        coverage: {
          canon: {
            id: decoded.canon.id,
            orderedBooks: [...decoded.canon.orderedBooks],
          },
          versification: decoded.versification,
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
    },
  }
}

export const unavailableHttpBibleChapterAdapter: BibleChapterAdapter = {
  loadVerseTexts: async () => ({ status: 'unavailable', reason: 'resource-unsupported' }),
  loadChapter: async () => ({ status: 'unavailable', reason: 'resource-unsupported' }),
  loadCoverage: async () => ({ status: 'unavailable', reason: 'resource-unsupported' }),
}
