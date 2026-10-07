import { WEB_APP_ORIGIN, type ResourceLanguage } from '../resources/publicSite'

/** The letters a publication files its topics under: the plain initial of their name. */
export const NAVE_LETTERS = [...'abcdefghijklmnopqrstuvwxyz']

export const isNaveLetter = (value: string | undefined): boolean =>
  value !== undefined && NAVE_LETTERS.includes(value)

/**
 * A topic is named in a path by its published `normalizedName` (ADR-0054). Only the
 * surrounding whitespace is dropped: case, spaces and punctuation belong to the identity.
 */
export const parseNaveTopic = (raw: string | undefined): string | undefined =>
  raw?.trim() || undefined

/** The topics of a language, filed by letter. */
export const buildNaveIndexPath = (language: ResourceLanguage): string => `/nave/${language}`

/**
 * The topics filed under a letter, a numbered page at a time. The first page has no
 * number, and `index` keeps the list apart from a topic, which is a single segment.
 */
export const buildNaveLetterPath = (language: ResourceLanguage, letter: string, page = 1): string =>
  `/nave/${language}/index/${letter}${page > 1 ? `/${page}` : ''}`

/** The name is percent-encoded as a whole, as the study workspace does (ADR-0054). */
export const buildNavePath = (language: ResourceLanguage, topic: string): string => {
  const name = parseNaveTopic(topic)
  if (!name) throw new Error('NAVE_ROUTE_INVALID')
  return `/nave/${language}/${encodeURIComponent(name)}`
}

/** A page number as written in a path: `2` and above; the first page has no number. */
export const parseNavePageNumber = (value: string | undefined): number | undefined =>
  value !== undefined && /^[1-9]\d{0,3}$/u.test(value) ? Number(value) : undefined

/** The most topics a list page holds. */
export const NAVE_LIST_PAGE_SIZE = 300

export const naveListPageCount = (topicCount: number): number =>
  Math.max(1, Math.ceil(topicCount / NAVE_LIST_PAGE_SIZE))

// Pages share the topics evenly, so a letter just over the limit has no nearly empty page.
const naveListPageLength = (topicCount: number): number =>
  Math.ceil(topicCount / naveListPageCount(topicCount))

/** The topics of a numbered page of a letter. */
export const naveListPage = <Topic>(topics: readonly Topic[], page: number): Topic[] => {
  const length = naveListPageLength(topics.length)
  return topics.slice((page - 1) * length, page * length)
}

/** The page of its letter a topic is listed on, from its position in the letter. */
export const naveListPageOf = (topicCount: number, position: number): number =>
  Math.floor(position / Math.max(1, naveListPageLength(topicCount))) + 1

/** The study workspace opens a topic under the same path. */
export const buildWebAppNaveUrl = (language: ResourceLanguage, topic: string): string =>
  `${WEB_APP_ORIGIN}${buildNavePath(language, topic)}`

/** The topic list of the study workspace. */
export const WEB_APP_NAVE_URL = `${WEB_APP_ORIGIN}/nave`
