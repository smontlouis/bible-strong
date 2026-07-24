import type { Verse } from '~common/types'
import { getMultipleVerses, getVerseText } from '~helpers/biblesDb'
import { buildStrongAnnotatedText, type StrongBibleSpan } from '~helpers/strongBibleOverlay'
import {
  getStrongBibleSidecarAvailability,
  loadStrongBibleChapterSpans,
  loadStrongBibleOccurrenceLocations,
  loadStrongBibleVerseCountsByBook,
  loadStrongBibleVerseSpans,
  type StrongBibleOccurrenceLocation,
  type StrongBibleOccurrencePage,
  type StrongBibleSidecarAvailability,
  type StrongBibleVerseCountByBook,
} from '~helpers/strongBibleSidecar'
import {
  ENGLISH_STRONG_BIBLE_PRIORITY,
  FRENCH_STRONG_BIBLE_PRIORITY,
  isStrongCapableBibleVersion,
  resolveStrongBibleVersion,
  type StrongBibleDatasetId,
  type StrongBibleVersionId,
} from '~helpers/strongBiblePublications'

export interface StrongBibleProvenance {
  versionId: StrongBibleVersionId
  datasetId: StrongBibleDatasetId
  isFallback: boolean
}

export interface StrongBibleResolutionRequest {
  currentVersionId: string
  defaultVersionId: StrongBibleVersionId
  preferredVersionId?: StrongBibleVersionId
  fallbackVersionIds?: readonly StrongBibleVersionId[]
}

export interface StrongBibleVerseRequest extends StrongBibleResolutionRequest {
  book: number
  chapter: number
  verse: number
}

export interface StrongBibleConcordanceRequest extends StrongBibleResolutionRequest {
  book: number
  reference: string | number
  limit?: number
  offset?: number
}

export type StrongBibleAttempt = {
  versionId: string
  status: StrongBibleSidecarAvailability['status']
}

type StrongBibleUnavailable = {
  status: 'unavailable'
  attempts: StrongBibleAttempt[]
}

type StrongBibleMissingLocation = {
  status: 'missing-location'
  provenance: StrongBibleProvenance
}

export type StrongBibleVerseResult =
  | StrongBibleUnavailable
  | StrongBibleMissingLocation
  | {
      status: 'available'
      provenance: StrongBibleProvenance
      verse: Verse
    }

export type StrongBibleCountsResult =
  | StrongBibleUnavailable
  | {
      status: 'available'
      provenance: StrongBibleProvenance
      counts: StrongBibleVerseCountByBook[]
    }

export type StrongBibleFoundVersesResult =
  | StrongBibleUnavailable
  | {
      status: 'available'
      provenance: StrongBibleProvenance
      verses: Verse[]
    }

export interface StrongBibleResourceDependencies {
  getAvailability: (versionId: string) => Promise<StrongBibleSidecarAvailability>
  getVerseText: (
    versionId: string,
    book: number,
    chapter: number,
    verse: number
  ) => Promise<string | null>
  getVerseSpans: (
    versionId: StrongBibleVersionId,
    book: number,
    chapter: number,
    verse: number
  ) => Promise<StrongBibleSpan[]>
  getChapterSpans: (
    versionId: StrongBibleVersionId,
    book: number,
    chapter: number
  ) => Promise<Record<number, StrongBibleSpan[]>>
  getCountsByBook: (
    versionId: StrongBibleVersionId,
    book: number,
    reference: string | number
  ) => Promise<StrongBibleVerseCountByBook[]>
  getFoundVerseLocations: (
    versionId: StrongBibleVersionId,
    book: number,
    reference: string | number,
    page?: StrongBibleOccurrencePage
  ) => Promise<StrongBibleOccurrenceLocation[]>
  getMultipleVerses: (versionId: string, verseKeys: string[]) => Promise<Record<string, string>>
  annotateText: (canonicalText: string, spans: StrongBibleSpan[]) => string
}

export interface StrongBibleResourceAccess {
  loadVerse: (request: StrongBibleVerseRequest) => Promise<StrongBibleVerseResult>
  loadCountsByBook: (request: StrongBibleConcordanceRequest) => Promise<StrongBibleCountsResult>
  loadFoundVersesByBook: (
    request: StrongBibleConcordanceRequest
  ) => Promise<StrongBibleFoundVersesResult>
}

const defaultDependencies: StrongBibleResourceDependencies = {
  getAvailability: getStrongBibleSidecarAvailability,
  getVerseText,
  getVerseSpans: loadStrongBibleVerseSpans,
  getChapterSpans: loadStrongBibleChapterSpans,
  getCountsByBook: loadStrongBibleVerseCountsByBook,
  getFoundVerseLocations: loadStrongBibleOccurrenceLocations,
  getMultipleVerses,
  annotateText: buildStrongAnnotatedText,
}

export const createStrongBibleResourceAccess = (
  dependencies: StrongBibleResourceDependencies = defaultDependencies
): StrongBibleResourceAccess => {
  const resolve = async (
    request: StrongBibleResolutionRequest
  ): Promise<
    | StrongBibleUnavailable
    | {
        status: 'available'
        provenance: StrongBibleProvenance
      }
  > => {
    const currentVersionId = resolveStrongBibleVersion(request.currentVersionId).versionId
    const useEnglishPriority =
      ENGLISH_STRONG_BIBLE_PRIORITY.includes(
        currentVersionId as (typeof ENGLISH_STRONG_BIBLE_PRIORITY)[number]
      ) ||
      ENGLISH_STRONG_BIBLE_PRIORITY.includes(
        request.defaultVersionId as (typeof ENGLISH_STRONG_BIBLE_PRIORITY)[number]
      )
    const languagePriority = useEnglishPriority
      ? ENGLISH_STRONG_BIBLE_PRIORITY
      : FRENCH_STRONG_BIBLE_PRIORITY
    const fallbackVersionIds = request.fallbackVersionIds ?? [
      ...(useEnglishPriority ? [] : [request.defaultVersionId]),
      ...languagePriority,
    ]
    const candidates = [
      ...new Set([request.preferredVersionId, currentVersionId, ...fallbackVersionIds]),
    ].filter((candidate): candidate is string => Boolean(candidate))
    const attempts: StrongBibleAttempt[] = []

    for (const candidate of candidates) {
      if (!isStrongCapableBibleVersion(candidate)) {
        attempts.push({ versionId: candidate, status: 'unsupported' })
        continue
      }
      const availability = await dependencies.getAvailability(candidate)
      if (availability.status === 'available') {
        return {
          status: 'available',
          provenance: {
            versionId: candidate,
            datasetId: availability.datasetId as StrongBibleDatasetId,
            isFallback: candidate !== currentVersionId,
          },
        }
      }
      attempts.push({ versionId: candidate, status: availability.status })
    }

    return { status: 'unavailable', attempts }
  }

  return {
    async loadVerse(request) {
      const resolution = await resolve(request)
      if (resolution.status !== 'available') return resolution
      const { versionId } = resolution.provenance
      const [text, spans] = await Promise.all([
        dependencies.getVerseText(versionId, request.book, request.chapter, request.verse),
        dependencies.getVerseSpans(versionId, request.book, request.chapter, request.verse),
      ])
      if (text == null) {
        return { status: 'missing-location', provenance: resolution.provenance }
      }
      return {
        status: 'available',
        provenance: resolution.provenance,
        verse: {
          Livre: request.book,
          Chapitre: request.chapter,
          Verset: request.verse,
          Texte: dependencies.annotateText(text, spans),
        },
      }
    },

    async loadCountsByBook(request) {
      const resolution = await resolve(request)
      if (resolution.status !== 'available') return resolution
      return {
        status: 'available',
        provenance: resolution.provenance,
        counts: await dependencies.getCountsByBook(
          resolution.provenance.versionId,
          request.book,
          request.reference
        ),
      }
    },

    async loadFoundVersesByBook(request) {
      const resolution = await resolve(request)
      if (resolution.status !== 'available') return resolution
      const { versionId } = resolution.provenance
      const locations = await dependencies.getFoundVerseLocations(
        versionId,
        request.book,
        request.reference,
        { limit: request.limit, offset: request.offset }
      )
      const keys = locations.map(
        location => `${location.Livre}-${location.Chapitre}-${location.Verset}`
      )
      const texts = await dependencies.getMultipleVerses(versionId, keys)
      const chapters = [...new Set(locations.map(location => location.Chapitre))]
      const chapterSpans = new Map<number, Record<number, StrongBibleSpan[]>>(
        await Promise.all(
          chapters.map(
            async chapter =>
              [
                chapter,
                await dependencies.getChapterSpans(versionId, request.book, chapter),
              ] as const
          )
        )
      )
      const verses: Verse[] = []
      for (const location of locations) {
        const key = `${location.Livre}-${location.Chapitre}-${location.Verset}`
        const text = texts[key]
        if (text == null) continue
        const spans = chapterSpans.get(location.Chapitre)?.[location.Verset] ?? []
        verses.push({
          ...location,
          Texte: dependencies.annotateText(text, spans),
        })
      }
      return {
        status: 'available',
        provenance: resolution.provenance,
        verses,
      }
    },
  }
}

export const localStrongBibleResourceAccess = createStrongBibleResourceAccess()
