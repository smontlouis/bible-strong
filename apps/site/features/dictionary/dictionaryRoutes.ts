import { isResourceLanguage, WEB_APP_ORIGIN, type ResourceLanguage } from '../resources/publicSite'

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u

/** A work is named by the identity the Resource API publishes it under (`bost`, `isbe`). */
export const isDictionaryWorkId = (value: string | undefined): value is string =>
  !!value && SLUG_PATTERN.test(value)

/**
 * The language and the work of a path in their canonical spelling, or nothing when they
 * cannot name a dictionary. Whether the work is published is only known to the Resource API.
 */
export const parseDictionaryWorkRoute = (params: {
  language: string
  work: string
}): { language: ResourceLanguage; work: string } | undefined => {
  const language = params.language.toLowerCase()
  const work = params.work.toLowerCase()
  return isResourceLanguage(language) && isDictionaryWorkId(work) ? { language, work } : undefined
}

/** The identity of an article within its work: a positive integer, canonically unpadded. */
export const parseDictionaryEntryId = (raw: string | undefined): number | undefined => {
  if (!raw || !/^\d{1,15}$/u.test(raw)) return undefined
  return Number(raw) || undefined
}

/**
 * The readable label of an article address, derived from its heading exactly as in the
 * study workspace (ADR-0055). It never resolves an article: the numeric identity does.
 */
export const createDictionaryArticleSlug = (word: string): string =>
  word
    .normalize('NFD')
    .replace(/[̀-ͯ]/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, '-')
    .replace(/^-+|-+$/gu, '') || 'article'

export const DICTIONARY_LETTERS = [...'abcdefghijklmnopqrstuvwxyz']

// French headings file their accented initials under the plain letter.
const ACCENTED_INITIALS: Record<string, string[]> = {
  a: ['à', 'â'],
  c: ['ç'],
  e: ['é', 'è', 'ê', 'ë'],
  i: ['î', 'ï'],
  o: ['ô', 'œ'],
  u: ['ù', 'û'],
}

/**
 * Every spelling of the initial filed under a letter. The Resource API matches a prefix
 * exactly, so a letter list asks for each of them.
 */
export const dictionaryLetterInitials = (letter: string, language: ResourceLanguage): string[] => [
  letter,
  ...(language === 'fr' ? (ACCENTED_INITIALS[letter] ?? []) : []),
]

/** The letter an article is filed under; a heading starting with anything else is not filed. */
export const dictionaryLetter = (word: string, language: ResourceLanguage): string | undefined => {
  const initial = [...word.trim().toLowerCase()][0]
  if (!initial) return undefined
  return DICTIONARY_LETTERS.find(letter =>
    dictionaryLetterInitials(letter, language).includes(initial)
  )
}

/** How many articles a letter page lists. */
export const DICTIONARY_LIST_PAGE_SIZE = 200

export type DictionaryListSearch = { page?: number }

/**
 * A letter list is read a numbered page at a time. The key is always returned, so that
 * anything but a page number is read as no page instead of reaching the loader as written.
 */
export const validateDictionaryListSearch = (
  search: Record<string, unknown>
): DictionaryListSearch => ({
  page:
    typeof search.page === 'number' && Number.isSafeInteger(search.page) && search.page >= 1
      ? search.page
      : undefined,
})

/** The dictionaries available in a language. */
export const buildDictionaryIndexPath = (language: ResourceLanguage): string =>
  `/dictionary/${language}`

export const buildDictionaryWorkPath = (language: ResourceLanguage, work: string): string => {
  if (!isDictionaryWorkId(work)) throw new Error('DICTIONARY_ROUTE_INVALID')
  return `${buildDictionaryIndexPath(language)}/${work}`
}

/** The articles of a work filed under a letter. The first page has no number. */
export const buildDictionaryLetterPath = (
  language: ResourceLanguage,
  work: string,
  letter: string,
  page = 1
): string =>
  `${buildDictionaryWorkPath(language, work)}/${letter}${page > 1 ? `?page=${page}` : ''}`

export type DictionaryEntryRef = {
  language: ResourceLanguage
  work: string
  entryId: number
  word: string
}

export const buildDictionaryEntryPath = ({
  language,
  work,
  entryId,
  word,
}: DictionaryEntryRef): string => {
  if (!Number.isSafeInteger(entryId) || entryId <= 0) throw new Error('DICTIONARY_ROUTE_INVALID')
  return `${buildDictionaryWorkPath(language, work)}/${entryId}/${createDictionaryArticleSlug(word)}`
}

// The dictionary list of the study workspace.
export const WEB_APP_DICTIONARY_URL = `${WEB_APP_ORIGIN}/dictionnaire`

/** The study workspace opens an article at the same path (ADR-0055). */
export const buildWebAppDictionaryEntryUrl = (entry: DictionaryEntryRef): string =>
  `${WEB_APP_ORIGIN}${buildDictionaryEntryPath(entry)}`
