// The perspectives of the library (ADR-0106, ADR-0103 amendments of 2026-11-11): the broad family a
// passage speaks for, from the tradition and tags of its work. The same rule exists in SQL, so that
// each large perspective has its own partial vector index and a search within it reads only it.

/** The broad family a passage speaks for; works without a tradition are reference works. */
export const LIBRARY_PERSPECTIVES = [
  'adventist',
  'catholic',
  'orthodox',
  'patristic',
  'jewish',
  'evangelical',
  'protestant',
  'academic',
  'reference',
] as const
export type LibraryPerspective = (typeof LIBRARY_PERSPECTIVES)[number]

/**
 * The perspectives with their own partial HNSW index (migration 0041). The Protestant one is a
 * third of the library, dense enough for the shared index; the Orthodox one is a few hundred
 * passages, read whole.
 */
export const LIBRARY_INDEXED_PERSPECTIVES = [
  'adventist',
  'catholic',
  'patristic',
  'jewish',
  'evangelical',
  'academic',
  'reference',
] as const satisfies readonly LibraryPerspective[]

/** The words that place a work in a perspective, accents removed, in this order (first match wins). */
const PERSPECTIVE_WORDS: readonly (readonly [LibraryPerspective, string])[] = [
  ['adventist', 'adventiste'],
  ['catholic', 'catholi|thomiste|scolastique'],
  ['patristic', 'christianisme ancien|patristique'],
  // Before the Orthodox one: a Jewish work may be tagged Orthodox (modern Orthodox Judaism).
  ['jewish', 'judaisme|rabbinique'],
  ['orthodox', 'orthodox'],
  // Critical and university exegesis, whatever the confession of its authors.
  ['academic', 'exegese critique|universitaire|moderniste'],
  ['evangelical', 'dispensational|freres|evangelique|baptiste|restaurationniste|pentecot'],
]

export function perspectiveOf(
  tradition: string | null,
  tags: readonly string[]
): LibraryPerspective {
  if (!tradition && !tags.length) return 'reference'
  const words = [tradition ?? '', ...tags]
    .join(' ')
    .normalize('NFD')
    .replace(/[̀-ͯ]/gu, '')
    .toLowerCase()
  return (
    PERSPECTIVE_WORDS.find(([, pattern]) => new RegExp(pattern, 'u').test(words))?.[0] ??
    'protestant'
  )
}

const ACCENTED = 'àâäáãéèêëíìîïóòôöõúùûüçñÿ'
const UNACCENTED = 'aaaaaeeeeiiiiooooouuuucny'
const words = `translate(lower(coalesce(tradition, '') || ' ' || tags::text), '${ACCENTED}', '${UNACCENTED}')`

/**
 * `perspectiveOf` in SQL, on the `tradition` and `tags` columns of library_passages: an immutable
 * expression, the predicate of the partial indexes. A query uses an index only when it repeats this
 * expression, compared with the perspective as a literal. The tags are read as their JSON text,
 * which holds the same words; the integration test checks both rules on every catalog work.
 */
export const LIBRARY_PERSPECTIVE_SQL = `(case when coalesce(tradition, '') = '' and jsonb_array_length(tags) = 0 then 'reference' ${PERSPECTIVE_WORDS.map(
  ([perspective, pattern]) => `when ${words} ~ '${pattern}' then '${perspective}'`
).join(' ')} else 'protestant' end)`

/** The predicate of a perspective's partial index, the same in a query that should use it. */
export const libraryPerspectivePredicate = (perspective: LibraryPerspective) =>
  `${LIBRARY_PERSPECTIVE_SQL} = '${perspective}'`
