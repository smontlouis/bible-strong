/**
 * `dictionaryTermSlug` (resource-domain) written in SQL over a column: the heading decomposed,
 * its combining accents removed (U+0300 to U+036F), in lower case, every other run of characters
 * a hyphen, `article` when nothing is left. It is neither `unaccent` nor `bible_search_normalize`,
 * which spell œ, æ and ß as letters where the address of a page leaves them out.
 *
 * The index `dictionary_entries_term_slug` is built on this very expression over `word`, and a
 * query is served by it only when it writes the same expression: both take it from here. Every
 * function in it is immutable, as an index requires. An integration test keeps it equal to the
 * rule of the site on awkward headings.
 */
export const dictionaryTermSlugSql = (column: string): string =>
  `coalesce(nullif(btrim(regexp_replace(lower(regexp_replace(normalize(${column}, NFD), '[\\u0300-\\u036f]', '', 'g')), '[^a-z0-9]+', '-', 'g'), '-'), ''), 'article')`
