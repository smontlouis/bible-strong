import { parseBibleTextSearchQuery } from './bibleSearchInput'

const quoteFtsPhrase = (terms: readonly string[]) => `"${terms.join(' ')}"`

export const buildNearFtsQuery = (raw: string, distance: number = 5): string | null => {
  const query = parseBibleTextSearchQuery(raw)
  if (!query || query.kind === 'phrase' || query.terms.length < 2) return null

  return `NEAR(${query.terms.join(' ')}, ${distance})`
}

/**
 * Compiles the product's small search language to FTS5.
 *
 * An entirely quoted input is a phrase. Everything else is a natural list of
 * terms combined implicitly with AND. Prefixes are applied automatically so
 * the user never needs to type FTS operators or `*`.
 */
export const sanitizeFtsQuery = (raw: string): string => {
  const query = parseBibleTextSearchQuery(raw)
  if (!query) return ''

  if (query.kind === 'phrase') return quoteFtsPhrase(query.terms)

  return query.terms.map(term => `${term}*`).join(' ')
}
