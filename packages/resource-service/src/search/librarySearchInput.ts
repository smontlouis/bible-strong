// Arguments of a library search call (ADR-0103). The assistant is a trusted caller, but its
// arguments come from a model: every field is checked and unknown fields are refused.
import {
  LIBRARY_SEARCH_MAX_LIMIT,
  type LibrarySearchInput,
} from '../repositories/librarySearchRepository'
import { LIBRARY_CORPORA, type LibraryCorpus, type LibraryLanguage } from './libraryDocuments'

const strings = (value: unknown, check: (item: string) => boolean, max: number) => {
  if (value === undefined) return undefined
  if (
    !Array.isArray(value) ||
    value.length > max ||
    value.some(item => typeof item !== 'string' || !check(item))
  )
    throw new Error('LIBRARY_SEARCH_INVALID_INPUT')
  return value as string[]
}
const integer = (value: unknown, min: number, max: number) => {
  if (value === undefined) return undefined
  if (!Number.isInteger(value) || (value as number) < min || (value as number) > max)
    throw new Error('LIBRARY_SEARCH_INVALID_INPUT')
  return value as number
}

export const parseLibrarySearchInput = (value: unknown): LibrarySearchInput => {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('LIBRARY_SEARCH_INVALID_INPUT')
  const input = value as Record<string, unknown>
  const known = ['query', 'languages', 'corpora', 'traditions', 'works', 'book', 'chapter', 'limit']
  if (Object.keys(input).some(key => !known.includes(key)))
    throw new Error('LIBRARY_SEARCH_INVALID_INPUT')
  if (typeof input.query !== 'string' || input.query.trim().length < 2 || input.query.length > 500)
    throw new Error('LIBRARY_SEARCH_INVALID_INPUT')
  return {
    query: input.query,
    languages: strings(input.languages, item => item === 'fr' || item === 'en', 2) as
      | LibraryLanguage[]
      | undefined,
    corpora: strings(input.corpora, item => LIBRARY_CORPORA.includes(item as LibraryCorpus), 5) as
      | LibraryCorpus[]
      | undefined,
    traditions: strings(input.traditions, item => /^[\p{L} '-]{2,40}$/u.test(item), 4),
    works: strings(input.works, item => /^[A-Za-z0-9-]{1,64}$/u.test(item), 8),
    book: integer(input.book, 1, 66),
    chapter: integer(input.chapter, 1, 150),
    limit: integer(input.limit, 1, LIBRARY_SEARCH_MAX_LIMIT),
  }
}
