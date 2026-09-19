import type { Book } from '~assets/bible_versions/books-desc'
import {
  buildPublicBiblePath,
  type PublicBiblePresentation,
} from '~features/bible/publicBibleRoutes'
import {
  createStrongDetailRoute,
  parseStrongDetailRouteParams,
} from '~features/lexique/strongDetailRoutes'
import { getBook } from '~helpers/bibleBookCatalog'
import { buildPublicNavePath } from '~features/nave/publicNaveRoutes'
import { buildPublicCommentaryPath } from '~features/commentaries/publicCommentaryRoutes'
import { parseCommentaryProjectionId } from '~features/commentaries/commentarySelection'
import { buildPublicDictionaryPath } from '~features/dictionnary/publicDictionaryRoutes'
import {
  buildPublicTimelineEventPath,
  buildPublicTimelineIndexPath,
} from '~features/timeline/publicTimelineRoutes'

export type NavigableRoute = {
  pathname: string
  params?: Record<string, unknown>
}

const firstString = (value: unknown): string | undefined =>
  typeof value === 'string'
    ? value
    : Array.isArray(value) && typeof value[0] === 'string'
      ? value[0]
      : value == null
        ? undefined
        : String(value)

const parseJson = <T>(value: unknown): T | undefined => {
  if (typeof value !== 'string') return value as T | undefined
  try {
    return JSON.parse(value) as T
  } catch {
    return undefined
  }
}

const parsePositiveInteger = (value: unknown): number | undefined => {
  const number = Number(firstString(value))
  return Number.isSafeInteger(number) && number > 0 ? number : undefined
}

const parseBook = (value: unknown): Book | undefined => {
  const parsed = parseJson<Book | number>(value)
  const bookNumber = typeof parsed === 'number' ? parsed : parsed?.Numero
  return bookNumber ? getBook(bookNumber) : undefined
}

const parseFocusVerses = (value: unknown): number[] | undefined => {
  const parsed = parseJson<unknown>(value)
  if (!Array.isArray(parsed)) return undefined
  const verses = parsed.map(Number)
  return verses.every(verse => Number.isSafeInteger(verse) && verse >= 0) ? verses : undefined
}

const contiguousPassage = (verses: number[]) => {
  const ordered = [...new Set(verses)].sort((left, right) => left - right)
  if (!ordered.length) return undefined
  if (ordered.some((verse, index) => index > 0 && verse !== ordered[index - 1] + 1)) {
    return undefined
  }
  return {
    startVerse: ordered[0],
    ...(ordered.length > 1 ? { endVerse: ordered[ordered.length - 1] } : {}),
  }
}

const normalizeLegacyBibleRoute = (
  route: NavigableRoute,
  defaultVersion: string
): NavigableRoute => {
  const params = route.params ?? {}
  if (params.annotationId || params.isSelectionMode) return route

  const book = parseBook(params.book)
  const chapter = parsePositiveInteger(params.chapter)
  if (!book || !chapter) return route

  const version = firstString(params.version) || defaultVersion
  const strongMode = firstString(params.strongMode)
  const presentation: PublicBiblePresentation =
    strongMode === 'visible'
      ? 'strong'
      : strongMode === 'reverse-interlinear'
        ? 'reverse-interlinear'
        : 'text'
  const focusVerses = parseFocusVerses(params.focusVerses)
  const shouldFocus =
    firstString(params.contextDisplayMode) === 'focused' ||
    firstString(params.isReadOnly) === 'true'
  const verse = parsePositiveInteger(params.verse)
  const passage = shouldFocus
    ? contiguousPassage(focusVerses?.length ? focusVerses : verse !== undefined ? [verse] : [])
    : undefined
  if (shouldFocus && !passage) return route

  try {
    return {
      pathname: buildPublicBiblePath({
        version,
        presentation,
        book,
        chapter,
        ...(passage ? { passage } : {}),
      }),
    }
  } catch {
    return route
  }
}

export const normalizePublicRoute = (
  route: NavigableRoute,
  defaultBibleVersion: string,
  defaultLanguage: 'fr' | 'en' = 'fr',
  defaultTimelineLanguage: 'fr' | 'en' = defaultLanguage
): NavigableRoute => {
  if (route.pathname === '/bible-view') {
    return normalizeLegacyBibleRoute(route, defaultBibleVersion)
  }
  const strongPage = {
    '/strong': 'index',
    '/strong/dictionary': 'dictionary',
    '/strong/related': 'related',
    '/strong/concordance': 'concordance',
    '/strong/entity': 'entity',
  }[route.pathname] as 'index' | 'dictionary' | 'related' | 'concordance' | 'entity' | undefined
  if (strongPage) {
    const parsed = parseStrongDetailRouteParams(route.params ?? {})
    return createStrongDetailRoute(strongPage, parsed.context, {
      entityKey: parsed.entityKey,
    })
  }
  if (route.pathname === '/nave-detail') {
    const topic = firstString(route.params?.name_lower)?.trim()
    const language = firstString(route.params?.language)
    if (!topic) return route
    return {
      pathname: buildPublicNavePath({
        language: language === 'fr' || language === 'en' ? language : defaultLanguage,
        topic,
      }),
    }
  }
  if (route.pathname === '/dictionnary-detail') {
    const language = firstString(route.params?.language)
    const work = firstString(route.params?.work)?.trim().toLocaleLowerCase()
    const entryId = parsePositiveInteger(route.params?.entryId)
    const word = firstString(route.params?.word)?.trim()
    if ((language !== 'fr' && language !== 'en') || !work || !entryId || !word) return route
    try {
      return { pathname: buildPublicDictionaryPath({ language, work, entryId, word }) }
    } catch {
      return route
    }
  }
  if (route.pathname === '/timeline-home') {
    return { pathname: buildPublicTimelineIndexPath(defaultTimelineLanguage) }
  }
  if (route.pathname === '/event') {
    const slug = firstString(route.params?.slug)?.trim().toLocaleLowerCase()
    const language = firstString(route.params?.language)
    if (!slug) return route
    try {
      return {
        pathname: buildPublicTimelineEventPath({
          language: language === 'fr' || language === 'en' ? language : defaultTimelineLanguage,
          slug,
        }),
      }
    } catch {
      return route
    }
  }
  if (route.pathname === '/commentary-chapter' || route.pathname === '/commentary-entry') {
    const projection = parseCommentaryProjectionId(firstString(route.params?.projectionId) ?? '')
    const book = parsePositiveInteger(route.params?.book)
    const chapter = parsePositiveInteger(route.params?.chapter)
    const sectionId = firstString(route.params?.sectionId)
    const focusVerse = parsePositiveInteger(route.params?.focusVerse)
    if (
      !projection ||
      !book ||
      !chapter ||
      (route.pathname === '/commentary-entry' && !sectionId)
    ) {
      return route
    }
    try {
      return {
        pathname: buildPublicCommentaryPath({
          resourceId: projection.resourceId,
          language: projection.language,
          book,
          chapter,
          ...(sectionId ? { sectionId } : {}),
          ...(focusVerse ? { focusVerse } : {}),
        }),
      }
    } catch {
      return route
    }
  }
  return route
}
