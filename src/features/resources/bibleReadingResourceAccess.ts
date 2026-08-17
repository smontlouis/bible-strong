import type { Pericope, Verse } from '~common/types'
import getBiblePericope from '~helpers/getBiblePericope'
import loadMhyComments from '~helpers/loadMhyComments'
import { loadRedWords } from '~helpers/loadRedWords'
import loadTresorReferences from '~helpers/loadTresorReferences'
import type { VersionCode } from '~state/tabs'
import { mapLocalResourceError, unwrapLocalResourceResult } from './resourceAccessError'
import { getLocalResourceAvailability } from './resourceAvailability'
import type { ResourceLanguage } from '~helpers/databaseTypes'
import type { ResourceAvailability } from './resourceModel'
import { usesCanonicalBibleExtras } from '~helpers/strongBiblePublications'
import { versionHasPericope } from '~helpers/pericopes'
import { versionHasRedWords } from '~helpers/redWords'
import type { OfflineCopyIdentity } from '~helpers/offlineCopyId'
import { getCanonicalChapterPericope } from '~helpers/canonicalBibleHeadings'
import { Schema } from 'effect'
import { BiblePericopeIndexDto } from './bibleChapterContract'
import { CommentaryChapterResponseDto, CrossReferenceResponseDto } from './supplementaryContract'

export type BibleChapterComments = { serializedComments: string }

type RedWordsRange = { start: number; end: number }
export type RedWordsByVerse = Record<string, RedWordsRange[]>

export type TresorReferences = string[]

export type BibleReadingAvailability =
  | { status: 'available' }
  | { status: 'unsupported' }
  | {
      status: 'unavailable'
      reason: 'offline-copy-required' | 'invalid-offline-copy'
      recoveryIdentity: OfflineCopyIdentity
    }

export type BibleReadingResourceAccess = {
  getPericopeAvailability?: (version: VersionCode) => Promise<BibleReadingAvailability>
  getMhyAvailability?: (language: ResourceLanguage) => Promise<BibleReadingAvailability>
  getRedWordsAvailability?: (version: VersionCode) => Promise<BibleReadingAvailability>
  loadPericope: (version: VersionCode) => Promise<Pericope>
  loadMhyComments: (book: number, chapter: number) => Promise<BibleChapterComments | undefined>
  loadRedWords: (version: VersionCode) => Promise<RedWordsByVerse | null>
  getTresorAvailability?: (language: ResourceLanguage) => Promise<ResourceAvailability>
  loadTresorReferences: (verse: string) => Promise<TresorReferences | undefined>
}

const mapReadingAvailability = async (
  identity: OfflineCopyIdentity
): Promise<BibleReadingAvailability> => {
  const availability = await getLocalResourceAvailability(identity)
  if (availability.status === 'available') return { status: 'available' }
  return {
    status: 'unavailable',
    reason: availability.status === 'missing' ? 'offline-copy-required' : 'invalid-offline-copy',
    recoveryIdentity: identity,
  }
}

export const localBibleReadingResourceAccess: BibleReadingResourceAccess = {
  getPericopeAvailability: version => {
    if (usesCanonicalBibleExtras(version)) {
      return mapReadingAvailability({ kind: 'bible', versionId: version })
    }
    if (!versionHasPericope(version)) return Promise.resolve({ status: 'unsupported' })
    return getLocalResourceAvailability({ kind: 'bible-pericope', versionId: version }).then(
      availability =>
        availability.status === 'available'
          ? { status: 'available' }
          : {
              status: 'unavailable',
              reason:
                availability.status === 'missing'
                  ? 'offline-copy-required'
                  : 'invalid-offline-copy',
              recoveryIdentity: { kind: 'bible', versionId: version },
            }
    )
  },
  getMhyAvailability: language =>
    language === 'fr'
      ? mapReadingAvailability({ kind: 'database', databaseId: 'MHY', language: 'fr' })
      : Promise.resolve({ status: 'unsupported' }),
  getRedWordsAvailability: version => {
    if (usesCanonicalBibleExtras(version)) return Promise.resolve({ status: 'available' })
    if (!versionHasRedWords(version)) return Promise.resolve({ status: 'unsupported' })
    return getLocalResourceAvailability({ kind: 'bible-red-words', versionId: version }).then(
      availability =>
        availability.status === 'available'
          ? { status: 'available' }
          : {
              status: 'unavailable',
              reason:
                availability.status === 'missing'
                  ? 'offline-copy-required'
                  : 'invalid-offline-copy',
              recoveryIdentity: { kind: 'bible', versionId: version },
            }
    )
  },
  loadPericope: getBiblePericope,
  loadMhyComments: async (book, chapter) => {
    const comments = unwrapLocalResourceResult(await loadMhyComments(book, chapter))
    return comments ? { serializedComments: comments.commentaires } : undefined
  },
  loadRedWords,
  getTresorAvailability: async language => {
    const availability = await getLocalResourceAvailability({
      kind: 'database',
      databaseId: 'TRESOR',
      language,
    })
    if (availability.status === 'available') return { status: 'available' }
    return {
      status: 'unavailable',
      reason: availability.status === 'missing' ? 'offline-copy-required' : 'invalid-offline-copy',
      recoveries:
        availability.status === 'missing'
          ? ['acquire-offline-copy']
          : ['acquire-offline-copy', 'manage-offline-copies'],
    }
  },
  loadTresorReferences: async verse => {
    try {
      const references = await loadTresorReferences(verse)
      if (!references?.commentaires) return undefined
      const parsed: unknown = JSON.parse(references.commentaires)
      return Array.isArray(parsed)
        ? parsed.filter((reference): reference is string => typeof reference === 'string')
        : []
    } catch (error) {
      throw mapLocalResourceError(error)
    }
  },
}

type HttpBibleReadingOptions = {
  baseUrl: string
  fetcher?: typeof fetch
  isOnline: () => Promise<boolean>
  timeoutMs?: number
}

export const createHttpBibleReadingResourceAccess = ({
  baseUrl,
  fetcher = fetch,
  isOnline,
  timeoutMs = 8_000,
}: HttpBibleReadingOptions): Pick<
  BibleReadingResourceAccess,
  | 'getPericopeAvailability'
  | 'loadPericope'
  | 'getMhyAvailability'
  | 'loadMhyComments'
  | 'getTresorAvailability'
  | 'loadTresorReferences'
> => ({
  getPericopeAvailability: async () =>
    (await isOnline()) ? { status: 'available' } : { status: 'unsupported' },
  loadPericope: async version => {
    if (!(await isOnline())) throw new Error('BIBLE_PERICOPE_HTTP_OFFLINE')
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const response = await fetcher(
        `${baseUrl.replace(/\/$/, '')}/v1/bibles/${encodeURIComponent(version)}/pericopes`,
        { headers: { accept: 'application/json' }, signal: controller.signal }
      )
      if (!response.ok) throw new Error(`BIBLE_PERICOPE_HTTP_${response.status}`)
      const payload = Schema.decodeUnknownSync(BiblePericopeIndexDto)(await response.json())
      return getCanonicalChapterPericope(
        payload.verses.map(item => ({
          Livre: item.book,
          Chapitre: item.chapter,
          Verset: item.verse,
          Texte: '',
          Headings: [...item.headings] as NonNullable<Verse['Headings']>,
        })) as Verse[]
      )
    } finally {
      clearTimeout(timeout)
    }
  },
  getMhyAvailability: async language =>
    language === 'fr'
      ? (await isOnline())
        ? { status: 'available' }
        : {
            status: 'unavailable',
            reason: 'offline-copy-required',
            recoveryIdentity: { kind: 'database', databaseId: 'MHY', language: 'fr' },
          }
      : { status: 'unsupported' },
  loadMhyComments: async (book, chapter) => {
    if (!(await isOnline())) throw new Error('COMMENTARY_HTTP_OFFLINE')
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const response = await fetcher(
        `${baseUrl.replace(/\/$/, '')}/v1/commentaries/MHY/fr/chapters/${book}/${chapter}`,
        { headers: { accept: 'application/json' }, signal: controller.signal }
      )
      if (!response.ok) {
        if (response.status === 404) return undefined
        throw new Error(`COMMENTARY_HTTP_${response.status}`)
      }
      const decoded = Schema.decodeUnknownSync(CommentaryChapterResponseDto)(await response.json())
      if (decoded.book !== book || decoded.chapter !== chapter) {
        throw new Error('COMMENTARY_HTTP_INTEGRITY')
      }
      return { serializedComments: decoded.serializedComments }
    } finally {
      clearTimeout(timeout)
    }
  },
  getTresorAvailability: async language =>
    language === 'fr'
      ? (await isOnline())
        ? { status: 'available' }
        : {
            status: 'unavailable',
            reason: 'offline-copy-required',
            recoveries: ['acquire-offline-copy'],
          }
      : {
          status: 'unavailable',
          reason: 'offline-copy-required',
          recoveries: ['acquire-offline-copy'],
        },
  loadTresorReferences: async verse => {
    if (!(await isOnline())) throw new Error('CROSS_REFERENCES_HTTP_OFFLINE')
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const response = await fetcher(
        `${baseUrl.replace(/\/$/, '')}/v1/cross-references/fr/verses/${encodeURIComponent(verse)}`,
        { headers: { accept: 'application/json' }, signal: controller.signal }
      )
      if (!response.ok) {
        if (response.status === 404) return undefined
        throw new Error(`CROSS_REFERENCES_HTTP_${response.status}`)
      }
      const decoded = Schema.decodeUnknownSync(CrossReferenceResponseDto)(await response.json())
      if (decoded.verseKey !== verse) throw new Error('CROSS_REFERENCES_HTTP_INTEGRITY')
      return [...decoded.references]
    } finally {
      clearTimeout(timeout)
    }
  },
})

export const createHybridBibleReadingResourceAccess = (options: {
  local: BibleReadingResourceAccess
  online: Pick<BibleReadingResourceAccess, 'getPericopeAvailability' | 'loadPericope'> &
    Partial<
      Pick<
        BibleReadingResourceAccess,
        'getMhyAvailability' | 'loadMhyComments' | 'getTresorAvailability' | 'loadTresorReferences'
      >
    >
  remotelyReadableVersions: ReadonlySet<string>
  isOnline: () => Promise<boolean>
}): BibleReadingResourceAccess => ({
  ...options.local,
  getPericopeAvailability: async version => {
    const local = await options.local.getPericopeAvailability?.(version)
    if (local?.status === 'available') return local
    if (options.remotelyReadableVersions.has(version) && (await options.isOnline())) {
      return { status: 'available' }
    }
    return local ?? { status: 'unsupported' }
  },
  loadPericope: async version => {
    const local = await options.local.getPericopeAvailability?.(version)
    if (local?.status === 'available') return options.local.loadPericope(version)
    if (options.remotelyReadableVersions.has(version) && (await options.isOnline())) {
      return options.online.loadPericope(version)
    }
    return options.local.loadPericope(version)
  },
  getMhyAvailability: async language => {
    const local = await options.local.getMhyAvailability?.(language)
    if (local?.status === 'available') return local
    if (language === 'fr' && (await options.isOnline()) && options.online.getMhyAvailability) {
      return options.online.getMhyAvailability(language)
    }
    return local ?? { status: 'unsupported' }
  },
  loadMhyComments: async (book, chapter) => {
    const local = await options.local.getMhyAvailability?.('fr')
    if (local?.status === 'available') return options.local.loadMhyComments(book, chapter)
    if ((await options.isOnline()) && options.online.loadMhyComments) {
      return options.online.loadMhyComments(book, chapter)
    }
    return options.local.loadMhyComments(book, chapter)
  },
  getTresorAvailability: async language => {
    const local = await options.local.getTresorAvailability?.(language)
    if (local?.status === 'available') return local
    if (language === 'fr' && (await options.isOnline()) && options.online.getTresorAvailability) {
      return options.online.getTresorAvailability(language)
    }
    return (
      local ?? {
        status: 'unavailable',
        reason: 'offline-copy-required',
        recoveries: ['acquire-offline-copy'],
      }
    )
  },
  loadTresorReferences: async verse => {
    const local = await options.local.getTresorAvailability?.('fr')
    if (local?.status === 'available') return options.local.loadTresorReferences(verse)
    if ((await options.isOnline()) && options.online.loadTresorReferences) {
      return options.online.loadTresorReferences(verse)
    }
    return options.local.loadTresorReferences(verse)
  },
})
