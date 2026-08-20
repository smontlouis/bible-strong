import { Schema } from 'effect'

import type { Verse } from '~common/types'
import type { BibleVersionCoverage } from '~helpers/biblesDb'
import type { BibleRecoveryAction } from '~helpers/bibleErrors'
import type { ResourceAccessErrorDiagnostics } from './resourceAccessError'
import { resourceAccessErrorFromHttpResponse } from './resourceAccessError'
import { warnAboutRecoverableResourceIntegrity } from './recoverableIntegrity'
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
      diagnostics?: ResourceAccessErrorDiagnostics
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
      diagnostics?: ResourceAccessErrorDiagnostics
    }

export type BibleCoverageSourceResult =
  | {
      status: 'available'
      coverage: BibleVersionCoverage
      textRevision?: string
      textSha256?: string
    }
  | {
      status: 'unavailable'
      reason: BibleChapterUnavailableReason
      diagnostics?: ResourceAccessErrorDiagnostics
    }

export const isUsableBibleCoverage = (result: BibleCoverageSourceResult) =>
  result.status === 'available' && result.coverage.books.length > 0

export class BibleVerseTextSourceError extends Error {
  constructor(
    public readonly reason: BibleChapterUnavailableReason,
    public readonly recoveries?: BibleRecoveryAction[],
    public readonly diagnostics?: ResourceAccessErrorDiagnostics
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
      throw new BibleVerseTextSourceError(
        selection.reason,
        selection.recoveries,
        selection.diagnostics
      )
    }
    const revisionMismatch =
      (expectedTextRevision !== undefined && selection.textRevision !== expectedTextRevision) ||
      (expectedTextSha256 !== undefined && selection.textSha256 !== expectedTextSha256)
    const requestedVerseKeys = verseKeys.filter(verseKey => parseBibleVerseKey(verseKey))
    const missingVerseKeys = requestedVerseKeys.filter(
      verseKey => selection.texts[verseKey] === undefined
    )
    if (revisionMismatch || missingVerseKeys.length) {
      warnAboutRecoverableResourceIntegrity('bible-verse-text-selection-incomplete', {
        version,
        revisionMismatch,
        missingVerseKeys,
      })
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
  let revisionMismatch = false
  for (const group of chapters.values()) {
    if (shouldCancel?.()) return result
    const chapterResult = await adapter.loadChapter(version, group.book, group.chapter)
    if (chapterResult.status !== 'available') {
      throw new BibleVerseTextSourceError(
        chapterResult.reason,
        chapterResult.recoveries,
        chapterResult.diagnostics
      )
    }
    if (
      (expectedTextRevision !== undefined && chapterResult.textRevision !== expectedTextRevision) ||
      (expectedTextSha256 !== undefined && chapterResult.textSha256 !== expectedTextSha256)
    ) {
      revisionMismatch = true
    }

    const requestedKeys = new Set(group.verseKeys)
    for (const verse of chapterResult.verses) {
      const verseKey = `${verse.Livre}-${verse.Chapitre}-${verse.Verset}`
      if (requestedKeys.has(verseKey)) result[verseKey] = verse.Texte
    }
  }

  const requestedVerseKeys = [...chapters.values()].flatMap(group => group.verseKeys)
  const missingVerseKeys = requestedVerseKeys.filter(verseKey => result[verseKey] === undefined)
  if (revisionMismatch || missingVerseKeys.length) {
    warnAboutRecoverableResourceIntegrity('bible-verse-text-selection-incomplete', {
      version,
      revisionMismatch,
      missingVerseKeys,
    })
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
    | {
        status: 'unavailable'
        reason: BibleChapterUnavailableReason
        diagnostics?: ResourceAccessErrorDiagnostics
      }
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
        const reason = problemReason(response.status, code)
        const resourceCode =
          reason === 'resource-unsupported'
            ? 'RESOURCE_UNSUPPORTED'
            : reason === 'chapter-not-available' || reason === 'verses-not-available'
              ? 'NOT_FOUND'
              : 'TEMPORARY_UNAVAILABLE'
        const error = resourceAccessErrorFromHttpResponse(resourceCode, response, code)
        return {
          status: 'unavailable',
          reason,
          diagnostics: {
            ...(error.httpStatus === undefined ? {} : { httpStatus: error.httpStatus }),
            ...(error.requestId === undefined ? {} : { requestId: error.requestId }),
            ...(error.retryAfterSeconds === undefined
              ? {}
              : { retryAfterSeconds: error.retryAfterSeconds }),
            ...(error.serverCode === undefined ? {} : { serverCode: error.serverCode }),
          },
        }
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
        if (decoded.resource.versionId !== version) {
          return { status: 'unavailable', reason: 'integrity-failure' }
        }
        const revision = decoded.resource.textRevision ?? decoded.resource.revision
        if (
          (textRevision !== undefined && revision !== textRevision) ||
          (textSha256 !== undefined && decoded.resource.textSha256 !== textSha256)
        ) {
          warnAboutRecoverableResourceIntegrity('bible-verse-text-batch-revision-mismatch', {
            version,
            batchOffset: offset,
            previousTextRevision: textRevision,
            receivedTextRevision: revision,
          })
        }
        textRevision ??= revision
        textSha256 ??= decoded.resource.textSha256
        const requestedReferences = new Set(batch)
        const omittedVerseKeys: string[] = []
        for (const verse of decoded.verses) {
          const key = `${verse.book}-${verse.chapter}-${verse.number}`
          if (!requestedReferences.has(key)) {
            omittedVerseKeys.push(key)
            continue
          }
          texts[key] = verse.text
        }
        if (omittedVerseKeys.length) {
          warnAboutRecoverableResourceIntegrity('bible-verse-text-unrequested-rows', {
            version,
            batchOffset: offset,
            omittedVerseKeys,
          })
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
      if (
        decoded.resource.versionId !== version ||
        decoded.book !== book ||
        decoded.chapter !== chapter
      ) {
        return { status: 'unavailable', reason: 'integrity-failure' }
      }
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
      if (decoded.resource.versionId !== version) {
        return { status: 'unavailable', reason: 'integrity-failure' }
      }
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
