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
  durationSeconds: number
}

type PassageMediaAnchor = {
  kind: 'book' | 'passage' | 'testament' | 'strong' | 'library'
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
  }
}

export type ResolvedPassageMedia = Pick<
  PassageMediaEdition,
  'provider' | 'providerId' | 'sourceUrl' | 'thumbnailUrl' | 'title' | 'durationSeconds'
> & {
  workId: string
  editionId: string
  attributionLabel: string
}

export type ResolvedPassageMediaChapter = {
  introduction: ResolvedPassageMedia[]
  afterVerses: Record<number, ResolvedPassageMedia[]>
  chapterResources: ResolvedPassageMedia[]
}

type ResolvePassageMediaChapterInput = {
  book: number
  chapter: number
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
    provider: edition.provider,
    providerId: edition.providerId,
    sourceUrl: edition.sourceUrl,
    thumbnailUrl: edition.thumbnailUrl,
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
      if (anchor.relevance !== 'primary' || anchor.book !== book) continue

      if (
        anchor.placement === 'introduction' &&
        ((anchor.kind === 'book' && chapter === 1) ||
          (anchor.kind === 'passage' && anchor.chapterStart === chapter))
      ) {
        result.introduction = appendUniqueEdition(result.introduction, edition)
        continue
      }

      if (
        anchor.placement === 'after-range' &&
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

const passageMediaCatalog = passageMediaJson as PassageMediaCatalog

export const getPassageMediaForChapter = (input: ResolvePassageMediaChapterInput) =>
  resolvePassageMediaChapter(passageMediaCatalog, input)
