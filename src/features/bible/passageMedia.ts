import passageMediaJson from '~assets/passage-media.json'
import { getBook } from '~helpers/bibleBookCatalog'
import type { ActiveLanguage } from '~helpers/languageUtils'
import englishBookNames from '../../../i18n/locales/en/translation_book.json'

type PassageMediaPlacement =
  | 'introduction'
  | 'after-range'
  | 'chapter-resources'
  | 'library'
  | 'related-resource'
  | 'strong-resource'

type PassageMediaRelevance = 'primary' | 'related'

export type PassageMediaCategory =
  | 'how-to-read'
  | 'podcast'
  | 'classroom'
  | 'long-form'
  | 'uncategorized'

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
  categories?: PassageMediaCategory[]
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
    library?: string[]
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
  reference: string
  strongCodes: string[]
}

export type ResolvedPassageMediaChapter = {
  introduction: ResolvedPassageMedia[]
  isIntroductionStartChapter: boolean
  afterVerses: Record<number, ResolvedPassageMedia[]>
  chapterResources: ResolvedPassageMedia[]
}

export type ResolvedPassageMediaLibraryItem = ResolvedPassageMedia & {
  categories: PassageMediaCategory[]
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

const PASSAGE_MEDIA_PLAYER_URL = 'https://bible-strong.app/embed/youtube.html'

export const getPassageMediaEmbedUrl = (providerId: string): string =>
  `${PASSAGE_MEDIA_PLAYER_URL}?v=${encodeURIComponent(providerId)}`

type ResolvePassageMediaChapterInput = {
  book: number
  chapter: number
  language: ActiveLanguage
}

type ResolvePassageMediaStrongInput = {
  strongCode: string
  language: ActiveLanguage
}

type ResolvePassageMediaLibraryInput = {
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

const getLocalizedBookName = (book: number, language: ActiveLanguage): string => {
  const bookName = getBook(book)?.Nom
  if (!bookName) return language === 'en' ? `Book ${book}` : `Livre ${book}`
  if (language === 'fr') return bookName

  return englishBookNames[bookName as keyof typeof englishBookNames] ?? bookName
}

const formatPassageAnchorReference = (
  anchor: PassageMediaAnchor,
  language: ActiveLanguage
): string => {
  if (anchor.book === undefined) return ''

  const bookName = getLocalizedBookName(anchor.book, language)
  if (anchor.kind === 'book' || anchor.chapterStart === undefined) return bookName

  const chapterEnd = anchor.chapterEnd ?? anchor.chapterStart
  const start = anchor.verseStart
    ? `${anchor.chapterStart}:${anchor.verseStart}`
    : `${anchor.chapterStart}`
  const end = anchor.verseEnd
    ? chapterEnd === anchor.chapterStart
      ? `${anchor.verseEnd}`
      : `${chapterEnd}:${anchor.verseEnd}`
    : `${chapterEnd}`

  return start === end ? `${bookName} ${start}` : `${bookName} ${start}–${end}`
}

const getWorkReference = (work: PassageMediaWork, language: ActiveLanguage): string => {
  const bibleAnchors = work.anchors.filter(
    anchor => (anchor.kind === 'book' || anchor.kind === 'passage') && anchor.book !== undefined
  )
  const bookAnchors = bibleAnchors.filter(anchor => anchor.kind === 'book')
  const passageAnchors = bibleAnchors.filter(anchor => anchor.kind === 'passage')
  const references: string[] = []

  if (bookAnchors.length) {
    const bookNumbers = [...new Set(bookAnchors.map(anchor => anchor.book as number))].sort(
      (left, right) => left - right
    )
    const areContiguous = bookNumbers.every(
      (bookNumber, index) => index === 0 || bookNumber === bookNumbers[index - 1] + 1
    )

    if (areContiguous && bookNumbers.length > 1) {
      references.push(
        `${getLocalizedBookName(bookNumbers[0], language)}–${getLocalizedBookName(bookNumbers[bookNumbers.length - 1], language)}`
      )
    } else {
      references.push(...bookNumbers.map(book => getLocalizedBookName(book, language)))
    }
  }

  references.push(
    ...passageAnchors.map(anchor => formatPassageAnchorReference(anchor, language)).filter(Boolean)
  )

  return [...new Set(references)].join(' · ')
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
    reference: getWorkReference(work, language),
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
    isIntroductionStartChapter: false,
    afterVerses: {},
    chapterResources: [],
  }
  const workIds = new Set(catalog.indexes.chapters[`${book}:${chapter}`] ?? [])
  catalog.works.forEach(work => {
    if (work.anchors.some(anchor => anchor.book === book && anchor.placement === 'introduction')) {
      workIds.add(work.id)
    }
  })
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
        (anchor.kind === 'book' ||
          (anchor.kind === 'passage' &&
            anchor.chapterStart !== undefined &&
            chapter >= anchor.chapterStart &&
            chapter <= (anchor.chapterEnd ?? anchor.chapterStart)))
      ) {
        result.introduction = appendUniqueEdition(result.introduction, edition)
        const introductionStartChapter = anchor.kind === 'book' ? 1 : anchor.chapterStart
        if (chapter === introductionStartChapter) result.isIntroductionStartChapter = true
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

export const resolvePassageMediaLibrary = (
  catalog: PassageMediaCatalog,
  { language }: ResolvePassageMediaLibraryInput
): ResolvedPassageMediaLibraryItem[] => {
  const works = getWorksById(catalog)
  const result: ResolvedPassageMediaLibraryItem[] = []

  for (const workId of catalog.indexes.library ?? []) {
    const work = works.get(workId)
    if (!work) continue

    const belongsToLibrary = work.anchors.some(
      anchor => anchor.kind === 'library' && anchor.placement === 'library'
    )
    if (!belongsToLibrary) continue

    const edition = resolveEdition(work, language, catalog.attribution.label)
    if (!edition || result.some(item => item.editionId === edition.editionId)) continue

    result.push({
      ...edition,
      categories: work.categories?.length ? work.categories : ['uncategorized'],
    })
  }

  return result
}

const passageMediaCatalog = passageMediaJson as PassageMediaCatalog

export const getPassageMediaForChapter = (input: ResolvePassageMediaChapterInput) =>
  resolvePassageMediaChapter(passageMediaCatalog, input)

export const getPassageMediaForStrong = (input: ResolvePassageMediaStrongInput) =>
  resolvePassageMediaStrong(passageMediaCatalog, input)

export const getPassageMediaLibrary = (input: ResolvePassageMediaLibraryInput) =>
  resolvePassageMediaLibrary(passageMediaCatalog, input)
