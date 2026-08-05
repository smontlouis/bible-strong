import passageMediaJson from '~assets/passage-media.json'
import type { ActiveLanguage } from '~helpers/languageUtils'

type PassageMediaPlacement =
  | 'introduction'
  | 'after-range'
  | 'chapter-resources'
  | 'library'
  | 'related-resource'
  | 'strong-resource'

type PassageMediaRelevance = 'primary' | 'related'

export type PassageMediaEdition = {
  id: string
  language: ActiveLanguage
  provider: 'youtube'
  providerId: string
  sourceUrl: string
  title: string
  thumbnailUrl: string
  blurHash: string
  durationSeconds: number
}

type PassageMediaAnchor = {
  kind: 'book' | 'passage' | 'testament' | 'strong' | 'library'
  code?: string
  book?: number
  chapterStart?: number
  verseStart?: number
  chapterEnd?: number
  verseEnd?: number
  placement: PassageMediaPlacement
  relevance: PassageMediaRelevance
}

type PassageMediaWork = {
  id: string
  editions: Partial<Record<ActiveLanguage, PassageMediaEdition>>
  anchors: PassageMediaAnchor[]
}

export type PassageMediaCatalog = {
  attribution: {
    label: string
    url: string
    termsUrl: string
  }
  works: PassageMediaWork[]
  indexes: {
    chapters: Record<string, string[]>
    strongs: Record<string, string[]>
  }
}

export type ResolvedPassageMedia = Pick<
  PassageMediaEdition,
  | 'provider'
  | 'providerId'
  | 'sourceUrl'
  | 'thumbnailUrl'
  | 'blurHash'
  | 'title'
  | 'durationSeconds'
> & {
  workId: string
  editionId: string
  attributionLabel: string
  strongCodes: string[]
}

export type ResolvedPassageMediaChapter = {
  introduction: ResolvedPassageMedia[]
  afterVerses: Record<number, ResolvedPassageMedia[]>
  chapterResources: ResolvedPassageMedia[]
}

export const formatPassageMediaDuration = (durationSeconds: number): string => {
  const totalSeconds = Math.max(0, Math.floor(durationSeconds))
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
  }

  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

export const getPassageMediaEmbedUrl = (providerId: string): string =>
  `https://www.youtube.com/embed/${encodeURIComponent(providerId)}?autoplay=1&playsinline=1&rel=0&modestbranding=1`

type ResolvePassageMediaChapterInput = {
  book: number
  chapter: number
  language: ActiveLanguage
}

type ResolvePassageMediaStrongInput = {
  strongCode: string
  language: ActiveLanguage
}

const worksByCatalog = new WeakMap<PassageMediaCatalog, Map<string, PassageMediaWork>>()

const getWorksById = (catalog: PassageMediaCatalog) => {
  const cached = worksByCatalog.get(catalog)
  if (cached) return cached

  const works = new Map(catalog.works.map(work => [work.id, work]))
  worksByCatalog.set(catalog, works)
  return works
}

const normalizeStrongCode = (strongCode: string): string => strongCode.trim().toUpperCase()

const getWorkStrongCodes = (work: PassageMediaWork): string[] => {
  const strongCodes = new Set<string>()

  work.anchors.forEach(anchor => {
    if (
      anchor.kind === 'strong' &&
      anchor.placement === 'strong-resource' &&
      anchor.code !== undefined
    ) {
      strongCodes.add(normalizeStrongCode(anchor.code))
    }
  })

  return Array.from(strongCodes)
}

const resolveEdition = (
  work: PassageMediaWork,
  language: ActiveLanguage,
  attributionLabel: string
): ResolvedPassageMedia | null => {
  const edition = work.editions[language]
  if (!edition) return null

  return {
    workId: work.id,
    editionId: edition.id,
    attributionLabel,
    strongCodes: getWorkStrongCodes(work),
    provider: edition.provider,
    providerId: edition.providerId,
    sourceUrl: edition.sourceUrl,
    thumbnailUrl: edition.thumbnailUrl,
    blurHash: edition.blurHash,
    title: edition.title,
    durationSeconds: edition.durationSeconds,
  }
}

const appendUniqueEdition = (
  items: ResolvedPassageMedia[],
  edition: ResolvedPassageMedia
): ResolvedPassageMedia[] =>
  items.some(item => item.editionId === edition.editionId) ? items : [...items, edition]

export const resolvePassageMediaChapter = (
  catalog: PassageMediaCatalog,
  { book, chapter, language }: ResolvePassageMediaChapterInput
): ResolvedPassageMediaChapter => {
  const result: ResolvedPassageMediaChapter = {
    introduction: [],
    afterVerses: {},
    chapterResources: [],
  }
  const workIds = catalog.indexes.chapters[`${book}:${chapter}`] ?? []
  const works = getWorksById(catalog)

  for (const workId of workIds) {
    const work = works.get(workId)
    if (!work) continue

    const edition = resolveEdition(work, language, catalog.attribution.label)
    if (!edition) continue

    for (const anchor of work.anchors) {
      if (anchor.book !== book) continue

      if (
        anchor.relevance === 'primary' &&
        anchor.placement === 'introduction' &&
        ((anchor.kind === 'book' && chapter === 1) ||
          (anchor.kind === 'passage' && anchor.chapterStart === chapter))
      ) {
        result.introduction = appendUniqueEdition(result.introduction, edition)
        continue
      }

      if (
        ((anchor.placement === 'after-range' && anchor.relevance === 'primary') ||
          (anchor.placement === 'related-resource' && anchor.relevance === 'related')) &&
        anchor.chapterEnd === chapter &&
        anchor.verseEnd !== undefined
      ) {
        result.afterVerses[anchor.verseEnd] = appendUniqueEdition(
          result.afterVerses[anchor.verseEnd] ?? [],
          edition
        )
        continue
      }

      if (
        anchor.relevance === 'primary' &&
        anchor.placement === 'chapter-resources' &&
        anchor.chapterStart !== undefined &&
        anchor.chapterEnd !== undefined &&
        chapter >= anchor.chapterStart &&
        chapter <= anchor.chapterEnd
      ) {
        result.chapterResources = appendUniqueEdition(result.chapterResources, edition)
      }
    }
  }

  return result
}

const getClassicalStrongCode = (strongCode: string): string => {
  const normalizedCode = normalizeStrongCode(strongCode)
  const match = normalizedCode.match(/^([HG])0*(\d+)/u)
  return match ? `${match[1]}${match[2].padStart(4, '0')}` : normalizedCode
}

export const resolvePassageMediaStrong = (
  catalog: PassageMediaCatalog,
  { strongCode, language }: ResolvePassageMediaStrongInput
): ResolvedPassageMedia[] => {
  const normalizedCode = normalizeStrongCode(strongCode)
  const classicalCode = getClassicalStrongCode(normalizedCode)
  const matchingCodes = new Set([normalizedCode, classicalCode])
  const workIds = [
    ...new Set([
      ...(catalog.indexes.strongs[normalizedCode] ?? []),
      ...(catalog.indexes.strongs[classicalCode] ?? []),
    ]),
  ]
  const works = getWorksById(catalog)
  let result: ResolvedPassageMedia[] = []

  for (const workId of workIds) {
    const work = works.get(workId)
    if (!work) continue

    const hasMatchingAnchor = work.anchors.some(
      anchor =>
        anchor.kind === 'strong' &&
        anchor.placement === 'strong-resource' &&
        anchor.code !== undefined &&
        matchingCodes.has(normalizeStrongCode(anchor.code))
    )
    if (!hasMatchingAnchor) continue

    const edition = resolveEdition(work, language, catalog.attribution.label)
    if (edition) result = appendUniqueEdition(result, edition)
  }

  return result
}

const passageMediaCatalog = passageMediaJson as PassageMediaCatalog

export const getPassageMediaForChapter = (input: ResolvePassageMediaChapterInput) =>
  resolvePassageMediaChapter(passageMediaCatalog, input)

export const getPassageMediaForStrong = (input: ResolvePassageMediaStrongInput) =>
  resolvePassageMediaStrong(passageMediaCatalog, input)
