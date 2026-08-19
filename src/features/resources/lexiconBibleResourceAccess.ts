import type { Verse } from '~common/types'
import type { ResourceLanguage } from '~helpers/databaseTypes'
import { getInterlinearLocalePriority } from '~helpers/interlinearBiblePublications'
import type {
  InterlinearSidecarAvailability,
  InterlinearToken,
} from '~helpers/interlinearBibleSidecar'
import {
  getDisplayedStrongIdentities,
  resolveDisplayedStrongIdentities,
} from '~helpers/strongIdentities'
import type { StrongBibleSpan } from '~helpers/canonicalStrongVerse'
import { collectStrongSelectionMorphologies } from '~helpers/strongSelection'
import {
  localStrongBibleResourceAccess,
  type StrongBibleResourceAccess,
  type StrongBibleConcordanceRequest,
  type StrongBibleCountsResult,
  type StrongBibleFoundVersesResult,
  type StrongBibleLemmaStatsResult,
  type StrongBibleLemmaStat,
  type StrongBibleVerseCountByBook,
  type StrongBibleVerseRequest,
  type StrongBibleVerseResult,
} from './strongBibleResourceAccess'
import type { BibleChapterAdapter } from './bibleChapterSource'
import type { InterlinearBibleResourceAccess } from './interlinearBibleResourceAccess'

export type BhgLexiconProvenance = {
  sourceKind: 'interlinear'
  versionId: 'BHG'
  datasetId: 'STEP'
  locale: ResourceLanguage
  isFallback: false
}

export type LexiconBibleProvenance =
  | BhgLexiconProvenance
  | Extract<StrongBibleVerseResult, { status: 'available' }>['provenance']

export type LexiconBibleVerseResult =
  | Exclude<StrongBibleVerseResult, { status: 'available' }>
  | {
      status: 'available'
      provenance: LexiconBibleProvenance
      verse: Verse
    }

export interface LexiconBibleVerseRequest extends StrongBibleVerseRequest {
  preferredInterlinearLocale: ResourceLanguage
}

export interface LexiconBibleConcordanceRequest extends Omit<
  StrongBibleConcordanceRequest,
  'pageToken'
> {
  preferredInterlinearLocale: ResourceLanguage
  pageToken?: string
}

type InterlinearLexiconConcordanceRequest = LexiconBibleConcordanceRequest & { cursor?: string }

export type BhgLexiconAvailability =
  | {
      status: 'available'
      locale: ResourceLanguage
    }
  | {
      status: 'unavailable'
      attempts: {
        locale: ResourceLanguage
        status: InterlinearSidecarAvailability['status']
      }[]
    }

export interface InterlinearLexiconAdapter {
  getInterlinearAvailability: (locale: ResourceLanguage) => Promise<InterlinearSidecarAvailability>
  loadVerse: (
    locale: ResourceLanguage,
    request: Pick<LexiconBibleVerseRequest, 'book' | 'chapter' | 'verse'>
  ) => Promise<{ text: string; tokens: InterlinearToken[] } | undefined>
  loadCountsByBook: (
    locale: ResourceLanguage,
    request: InterlinearLexiconConcordanceRequest
  ) => Promise<StrongBibleVerseCountByBook[]>
  loadFoundVersesByBook: (
    locale: ResourceLanguage,
    request: InterlinearLexiconConcordanceRequest
  ) => Promise<{ verses: Verse[]; nextCursor?: string }>
}

export interface LexiconBibleResourceDependencies {
  strongBible: Pick<
    StrongBibleResourceAccess,
    'loadVerse' | 'loadCountsByBook' | 'loadFoundVersesByBook' | 'loadLemmaStats'
  >
  interlinear: InterlinearLexiconAdapter
}

export interface LexiconBibleResourceAccess {
  getInterlinearAvailability: (locale: ResourceLanguage) => Promise<InterlinearSidecarAvailability>
  loadVerse: (request: LexiconBibleVerseRequest) => Promise<LexiconBibleVerseResult>
  loadCountsByBook: (request: LexiconBibleConcordanceRequest) => Promise<LexiconBibleCountsResult>
  loadFoundVersesByBook: (
    request: LexiconBibleConcordanceRequest
  ) => Promise<LexiconBibleFoundVersesResult>
  loadLemmaStats: (request: LexiconBibleConcordanceRequest) => Promise<LexiconBibleLemmaStatsResult>
}

export type LexiconBibleCountsResult =
  | Exclude<StrongBibleCountsResult, { status: 'available' }>
  | {
      status: 'available'
      provenance: LexiconBibleProvenance
      counts: StrongBibleVerseCountByBook[]
    }

type BhgLexiconFoundVersesResult = {
  status: 'available'
  provenance: BhgLexiconProvenance
  verses: Verse[]
  nextPageToken?: string
}

export type LexiconBibleFoundVersesResult =
  | Exclude<StrongBibleFoundVersesResult, { status: 'available' }>
  | BhgLexiconFoundVersesResult
  | {
      status: 'available'
      provenance: Extract<StrongBibleFoundVersesResult, { status: 'available' }>['provenance']
      verses: Verse[]
      identity?: Extract<StrongBibleFoundVersesResult, { status: 'available' }>['identity']
      nextPageToken?: string
    }

export type LexiconBibleLemmaStatsResult =
  | Exclude<StrongBibleLemmaStatsResult, { status: 'available' }>
  | {
      status: 'available'
      provenance: LexiconBibleProvenance
      lemmas: StrongBibleLemmaStat[]
    }

export const localInterlinearLexiconAdapter: InterlinearLexiconAdapter = {
  async getInterlinearAvailability(locale) {
    const { getInterlinearSidecarAvailability } = await import('~helpers/interlinearBibleSidecar')
    return getInterlinearSidecarAvailability(locale)
  },
  async loadVerse(locale, request) {
    const [{ getVerseText }, { loadInterlinearVerseTokens }] = await Promise.all([
      import('~helpers/biblesDb'),
      import('~helpers/interlinearBibleSidecar'),
    ])
    const [text, tokens] = await Promise.all([
      getVerseText('BHG', request.book, request.chapter, request.verse),
      loadInterlinearVerseTokens('BHG', locale, request.book, request.chapter, request.verse),
    ])
    return text == null ? undefined : { text, tokens }
  },
  loadCountsByBook(locale, request) {
    return import('~helpers/interlinearBibleSidecar').then(
      ({ loadInterlinearStrongVerseCountsByBook }) =>
        loadInterlinearStrongVerseCountsByBook(locale, request.reference)
    )
  },
  async loadFoundVersesByBook(locale, request) {
    const [{ getMultipleVerses }, { loadInterlinearStrongOccurrencePage }] = await Promise.all([
      import('~helpers/biblesDb'),
      import('~helpers/interlinearBibleSidecar'),
    ])
    const page = await loadInterlinearStrongOccurrencePage(locale, request.reference, {
      book: request.allBooks ? undefined : request.book,
      limit: request.limit,
      cursor: request.cursor,
    })
    const texts = await getMultipleVerses(
      'BHG',
      page.occurrences.map(({ Livre, Chapitre, Verset }) => `${Livre}-${Chapitre}-${Verset}`)
    )
    const verses = page.occurrences.flatMap(({ tokens, ...location }) => {
      const key = `${location.Livre}-${location.Chapitre}-${location.Verset}`
      const text = texts[key]
      return text == null
        ? []
        : [{ ...location, Texte: text, StrongSpans: createBhgStrongSpans(tokens) }]
    })
    return { verses, ...(page.nextCursor ? { nextCursor: page.nextCursor } : {}) }
  },
}

export const createHybridInterlinearLexiconAdapter = (
  interlinearBible: Pick<InterlinearBibleResourceAccess, 'getAvailability' | 'loadChapterTokens'>,
  bibleChapterAdapter: BibleChapterAdapter
): InterlinearLexiconAdapter => ({
  ...localInterlinearLexiconAdapter,
  getInterlinearAvailability: interlinearBible.getAvailability,
  async loadVerse(locale, request) {
    const [chapter, interlinear] = await Promise.all([
      bibleChapterAdapter.loadChapter('BHG', request.book, request.chapter),
      interlinearBible.loadChapterTokens(locale, request),
    ])
    if (chapter.status !== 'available') return undefined
    const text = chapter.verses.find(verse => Number(verse.Verset) === request.verse)?.Texte
    if (text == null) return undefined
    return { text, tokens: interlinear.tokensByVerse[request.verse] ?? [] }
  },
})

const defaultDependencies: LexiconBibleResourceDependencies = {
  strongBible: localStrongBibleResourceAccess,
  interlinear: localInterlinearLexiconAdapter,
}

type LexiconPage = { kind: 'strong'; cursor: string } | { kind: 'interlinear'; cursor: string }

const encodePageToken = (page: LexiconPage): string =>
  page.kind === 'strong' ? page.cursor : `interlinear:${page.cursor}`

const decodePageToken = (token?: string): LexiconPage | undefined => {
  if (!token) return undefined
  if (token.startsWith('strong:')) {
    return { kind: 'strong', cursor: token }
  }
  if (token.startsWith('interlinear:')) {
    const cursor = token.slice('interlinear:'.length)
    return cursor ? { kind: 'interlinear', cursor } : undefined
  }
  return undefined
}

const resolveBhgAvailability = async (
  preferredLocale: ResourceLanguage,
  getAvailability: InterlinearLexiconAdapter['getInterlinearAvailability']
): Promise<BhgLexiconAvailability> => {
  const attempts: Extract<BhgLexiconAvailability, { status: 'unavailable' }>['attempts'] = []

  for (const locale of getInterlinearLocalePriority(preferredLocale)) {
    const availability = await getAvailability(locale)
    if (availability.status === 'available') return { status: 'available', locale }
    attempts.push({ locale, status: availability.status })
  }

  return { status: 'unavailable', attempts }
}

export const getBhgLexiconAvailability = (
  preferredLocale: ResourceLanguage,
  getAvailability: InterlinearLexiconAdapter['getInterlinearAvailability'] = localInterlinearLexiconAdapter.getInterlinearAvailability
): Promise<BhgLexiconAvailability> => resolveBhgAvailability(preferredLocale, getAvailability)

export const createBhgStrongSpans = (tokens: InterlinearToken[]): StrongBibleSpan[] =>
  tokens.flatMap(token => {
    const identities = getDisplayedStrongIdentities(
      token.segments.flatMap(segment => segment.identities)
    )
    if (!identities.length) return []
    const morphologies = collectStrongSelectionMorphologies(identities, token.segments)

    return [
      {
        ordinal: token.ordinal,
        startOffset: token.startOffset,
        length: token.length,
        identities: identities.map(identity => ({ kind: identity.kind, code: identity.code })),
        ...(morphologies.length ? { morphologies } : {}),
      },
    ]
  })

const enrichStrongVerseWithInterlinearTokens = (
  verse: Verse,
  tokens: InterlinearToken[]
): Verse => {
  const tokensById = new Map(
    tokens.flatMap(token => (token.id == null ? [] : [[token.id, token] as const]))
  )
  const strongSpans = (verse.StrongSpans ?? []) as StrongBibleSpan[]

  return {
    ...verse,
    StrongSpans: strongSpans.map(span => {
      const alignedSegments = (span.stepTokenIds ?? []).flatMap(
        tokenId => tokensById.get(tokenId)?.segments ?? []
      )
      if (!alignedSegments.length) return span

      const identities = resolveDisplayedStrongIdentities(
        span.identities,
        alignedSegments.flatMap(segment => segment.identities)
      )
      const morphologies = collectStrongSelectionMorphologies(identities, alignedSegments)
      return {
        ...span,
        identities,
        ...(morphologies.length ? { morphologies } : {}),
      }
    }),
  }
}

export const createLexiconBibleResourceAccess = (
  dependencies: LexiconBibleResourceDependencies = defaultDependencies
): LexiconBibleResourceAccess => {
  const resolveBhg = async (request: LexiconBibleConcordanceRequest) => {
    if (request.currentVersionId !== 'BHG' || request.preferredVersionId) return undefined
    const availability = await resolveBhgAvailability(
      request.preferredInterlinearLocale,
      dependencies.interlinear.getInterlinearAvailability
    )
    return availability.status === 'available' ? availability.locale : undefined
  }

  const bhgProvenance = (locale: ResourceLanguage): BhgLexiconProvenance => ({
    sourceKind: 'interlinear',
    versionId: 'BHG',
    datasetId: 'STEP',
    locale,
    isFallback: false,
  })

  return {
    getInterlinearAvailability: dependencies.interlinear.getInterlinearAvailability,
    async loadVerse(request) {
      if (request.currentVersionId === 'BHG' && !request.preferredVersionId) {
        try {
          const availability = await resolveBhgAvailability(
            request.preferredInterlinearLocale,
            dependencies.interlinear.getInterlinearAvailability
          )
          if (availability.status === 'available') {
            const loaded = await dependencies.interlinear.loadVerse(availability.locale, request)
            const spans = createBhgStrongSpans(loaded?.tokens ?? [])
            if (loaded && spans.length) {
              return {
                status: 'available',
                provenance: {
                  sourceKind: 'interlinear',
                  versionId: 'BHG',
                  datasetId: 'STEP',
                  locale: availability.locale,
                  isFallback: false,
                },
                verse: {
                  Livre: request.book,
                  Chapitre: request.chapter,
                  Verset: request.verse,
                  Texte: loaded.text,
                  StrongSpans: spans,
                },
              }
            }
          }
        } catch {
          // A corrupt or unreadable contextual index must not block the traditional Strong fallback.
        }
      }

      const strongResult = await dependencies.strongBible.loadVerse(request)
      if (strongResult.status !== 'available') return strongResult

      try {
        const availability = await resolveBhgAvailability(
          request.preferredInterlinearLocale,
          dependencies.interlinear.getInterlinearAvailability
        )
        if (availability.status !== 'available') return strongResult
        const loaded = await dependencies.interlinear.loadVerse(availability.locale, request)
        if (!loaded) return strongResult
        return {
          ...strongResult,
          verse: enrichStrongVerseWithInterlinearTokens(strongResult.verse, loaded.tokens),
        }
      } catch {
        return strongResult
      }
    },

    async loadCountsByBook(request) {
      const locale = await resolveBhg(request)
      if (!locale) return dependencies.strongBible.loadCountsByBook(request)
      try {
        return {
          status: 'available',
          provenance: bhgProvenance(locale),
          counts: await dependencies.interlinear.loadCountsByBook(locale, request),
        }
      } catch {
        return dependencies.strongBible.loadCountsByBook(request)
      }
    },

    async loadFoundVersesByBook(request) {
      const page = decodePageToken(request.pageToken)
      const loadStrongPage = async (): Promise<LexiconBibleFoundVersesResult> => {
        const strongResult = await dependencies.strongBible.loadFoundVersesByBook({
          ...request,
          pageToken: page?.kind === 'strong' ? page.cursor : undefined,
        })
        if (strongResult.status !== 'available') return strongResult
        return {
          ...strongResult,
          ...(strongResult.nextPageToken ? { nextPageToken: strongResult.nextPageToken } : {}),
        }
      }

      const locale = page?.kind === 'strong' ? undefined : await resolveBhg(request)
      if (!locale) return loadStrongPage()
      try {
        const interlinearPage = await dependencies.interlinear.loadFoundVersesByBook(locale, {
          ...request,
          cursor: page?.kind === 'interlinear' ? page.cursor : undefined,
        })
        return {
          status: 'available',
          provenance: bhgProvenance(locale),
          verses: interlinearPage.verses,
          ...(interlinearPage.nextCursor
            ? {
                nextPageToken: encodePageToken({
                  kind: 'interlinear',
                  cursor: interlinearPage.nextCursor,
                }),
              }
            : {}),
        }
      } catch {
        if (page?.kind === 'interlinear') {
          throw new Error('The interlinear continuation could not be loaded')
        }
        return loadStrongPage()
      }
    },

    async loadLemmaStats(request) {
      const locale = await resolveBhg(request)
      if (!locale) return dependencies.strongBible.loadLemmaStats(request)
      return { status: 'available', provenance: bhgProvenance(locale), lemmas: [] }
    },
  }
}

export const localLexiconBibleResourceAccess = createLexiconBibleResourceAccess()
