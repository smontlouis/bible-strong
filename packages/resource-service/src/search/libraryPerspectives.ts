// The perspectives of the library (ADR-0106, ADR-0103 amendments of 2026-11-11): the broad family a
// passage speaks for, from the tradition and tags of its work.

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
