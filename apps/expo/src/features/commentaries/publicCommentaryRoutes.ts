import { COMMENTARY_CATALOG_BY_ID } from '@bible-strong/resource-catalog/commentaries'

import { getSupportedOsisBookId } from '~helpers/osisReference'
import type { ResourceLanguage } from '~helpers/databaseTypes'

export type PublicCommentaryRoute = {
  resourceId: string
  language: ResourceLanguage
  book: number
  chapter: number
  sectionId?: string
  focusVerse?: number
}

const BOOK_NUMBERS_BY_OSIS_SLUG = new Map(
  Array.from({ length: 77 }, (_, index) => index + 1).flatMap(bookNumber => {
    const osis = getSupportedOsisBookId(bookNumber)
    return osis ? [[osis.toLocaleLowerCase(), bookNumber] as const] : []
  })
)

const sectionSlug = (route: PublicCommentaryRoute): string | undefined => {
  if (!route.sectionId) return undefined
  const entry = COMMENTARY_CATALOG_BY_ID.get(route.resourceId)
  const prefix = `${entry?.publicationId}-${route.language}-${route.book}-${route.chapter}-`
  return entry && route.sectionId.startsWith(prefix)
    ? route.sectionId.slice(prefix.length)
    : route.sectionId
}

export const buildPublicCommentaryPath = (route: PublicCommentaryRoute): string => {
  const entry = COMMENTARY_CATALOG_BY_ID.get(route.resourceId)
  const osis = getSupportedOsisBookId(route.book)?.toLocaleLowerCase()
  if (!entry?.languages.includes(route.language) || !osis || route.chapter < 1) {
    throw new Error('PUBLIC_COMMENTARY_ROUTE_INVALID')
  }
  const section = sectionSlug(route)
  const path = `/commentary/${route.language}/${route.resourceId}/${osis}/${route.chapter}${
    section ? `/${encodeURIComponent(section)}` : ''
  }`
  return route.focusVerse ? `${path}?verse=${route.focusVerse}` : path
}

export const parsePublicCommentaryRoute = ({
  language,
  resource,
  book,
  chapter,
  section,
  verse,
}: Record<string, string | string[] | undefined>): PublicCommentaryRoute | undefined => {
  const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value)
  const lang = first(language)
  const resourceId = first(resource)
  const osis = first(book)
  const chapterNumber = Number(first(chapter))
  if (
    (lang !== 'fr' && lang !== 'en') ||
    !resourceId ||
    !COMMENTARY_CATALOG_BY_ID.get(resourceId)?.languages.includes(lang) ||
    !osis ||
    !Number.isSafeInteger(chapterNumber) ||
    chapterNumber < 1
  ) {
    return undefined
  }
  const bookNumber = BOOK_NUMBERS_BY_OSIS_SLUG.get(osis.toLocaleLowerCase())
  if (!bookNumber) return undefined
  const entry = COMMENTARY_CATALOG_BY_ID.get(resourceId)!
  const sectionValue = first(section)
  const focusVerse = Number(first(verse))
  return {
    resourceId,
    language: lang,
    book: bookNumber,
    chapter: chapterNumber,
    ...(sectionValue
      ? {
          sectionId: sectionValue.startsWith(`${entry.publicationId}-`)
            ? sectionValue
            : `${entry.publicationId}-${lang}-${bookNumber}-${chapterNumber}-${sectionValue}`,
        }
      : {}),
    ...(Number.isSafeInteger(focusVerse) && focusVerse > 0 ? { focusVerse } : {}),
  }
}
