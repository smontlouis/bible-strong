// Hybrid search over the library index (ADR-0103): nearest passages by meaning (HNSW on the
// half-precision vectors) and by words (the lexical vector of each passage's language), fused
// by reciprocal rank. One hit per resource: the best passage of a commentary section, a
// dictionary article or a profile, in the first requested language when both exist.
import { sql, type Kysely, type RawBuilder } from 'kysely'

import type { ResourceDatabase } from '../database/types'
import {
  LIBRARY_CORPORA,
  type LibraryCorpus,
  type LibraryLanguage,
} from '../search/libraryDocuments'
import { vectorLiteral, type LibraryEmbeddingProvider } from '../search/libraryEmbedding'

export type LibrarySearchInput = {
  query: string
  /** Preferred source languages, first one first; both are searched. */
  languages?: readonly LibraryLanguage[]
  corpora?: readonly LibraryCorpus[]
  /** Matched against the tradition and the tags of a work, such as "Catholicisme" or "Réformé". */
  traditions?: readonly string[]
  works?: readonly string[]
  /** Works left out of the search unless `works` names them (ADR-0106). */
  excludeWorks?: readonly string[]
  book?: number
  chapter?: number
  limit?: number
  /**
   * One hit per perspective first (ADR-0106): on a debated point the best passage of each
   * tradition, then one more per work, rather than the nearest passages of the largest one.
   */
  perspectives?: boolean
  /** Each hit also carries `text`: its whole passage, not only the snippet. */
  fullText?: boolean
  /**
   * With `fullText`, the best `sections` hits carry as `text` their whole section (every passage
   * of the same commentary section, article or entry, in order) when it fits
   * LIBRARY_SECTION_MAX_CHARACTERS, otherwise the passage with the one before and after it.
   */
  sections?: number
  /**
   * Also a search by perspective (amendment of 2026-11-11): up to this many hits of each
   * perspective, found by meaning and by words among that perspective's passages alone, returned
   * as `perspectiveHits`. A small tradition no longer has to be near the question to be heard; the
   * query is embedded once for both searches.
   */
  perPerspective?: number
  /** With `fullText` and `perPerspective`: the first this many hits of each perspective carry their whole section. */
  perspectiveSections?: number
  /** In the search by perspective, a document of these perspectives counts only when it carries labels. */
  labelledDocuments?: readonly LibraryPerspective[]
  /** Works the search by perspective leaves out in place of `excludeWorks` (which it takes by default). */
  perspectiveExcludeWorks?: readonly string[]
}

/** The broad family a passage speaks for; works without a tradition are reference works. */
export const LIBRARY_PERSPECTIVES = [
  'adventist',
  'catholic',
  'patristic',
  'jewish',
  'evangelical',
  'protestant',
  'reference',
] as const
export type LibraryPerspective = (typeof LIBRARY_PERSPECTIVES)[number]

/** The words that place a work in a perspective, accents removed, in this order (first match wins). */
const PERSPECTIVE_WORDS: readonly (readonly [LibraryPerspective, string])[] = [
  ['adventist', 'adventiste'],
  ['catholic', 'catholi|thomiste|scolastique'],
  ['patristic', 'christianisme ancien|patristique'],
  ['jewish', 'judaisme|rabbinique'],
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
    .replace(/[\u0300-\u036f]/gu, '')
    .toLowerCase()
  return (
    PERSPECTIVE_WORDS.find(([, pattern]) => new RegExp(pattern, 'u').test(words))?.[0] ??
    'protestant'
  )
}

/** The works of each perspective in each language, read once per search by perspective. */
type PerspectiveWorks = Map<LibraryPerspective, Map<LibraryLanguage, string[]>>

/**
 * One passage of every active publication, by its primary key (22 ms on 2026-11-11 for 123
 * publications): a filter by work lets the planner walk the vector index or read a small work
 * whole, where a filter on tradition and tags read most of the index.
 */
async function perspectiveWorks(database: Kysely<ResourceDatabase>): Promise<PerspectiveWorks> {
  const { rows } = await sql<{
    work: string
    language: LibraryLanguage
    tradition: string | null
    tags: string[]
  }>`
    select passage.work, passage.language, passage.tradition, passage.tags
    from resource_publications publication
    cross join lateral (
      select work, language, tradition, tags from library_passages
      where publication_id = publication.id limit 1
    ) passage
    where publication.status = 'active'`.execute(database)
  const works: PerspectiveWorks = new Map()
  for (const row of rows) {
    const perspective = perspectiveOf(row.tradition, row.tags)
    const languages = works.get(perspective) ?? new Map<LibraryLanguage, string[]>()
    const list = languages.get(row.language) ?? []
    if (!list.includes(row.work)) list.push(row.work)
    languages.set(row.language, list)
    works.set(perspective, languages)
  }
  return works
}

export type LibrarySearchHit = {
  corpus: LibraryCorpus
  language: LibraryLanguage
  work: string
  workTitle: string
  tradition: string | null
  tags: string[]
  title: string
  reference: {
    book: number
    chapter: number
    verseStart: number | null
    verseEnd: number | null
  } | null
  snippet: string
  /** With `fullText`: the whole passage, or its section for the best `sections` hits. */
  text?: string
  target: Record<string, string | number>
  score: number
  matched: 'semantic' | 'lexical' | 'both'
  perspective: LibraryPerspective
}

export type LibrarySearchResult = {
  hits: LibrarySearchHit[]
  /** With `perPerspective`: the hits of each perspective, in the order of LIBRARY_PERSPECTIVES, best first. */
  perspectiveHits?: LibrarySearchHit[]
  semantic: boolean
  timings: { embeddingMs: number; vectorMs: number; lexicalMs: number }
}

/** Deep enough that a large work leaves room for the others once capped (two hits a work). */
const CANDIDATES = 100
/** A search by perspective looks further, so that smaller traditions reach the selection. */
const PERSPECTIVE_CANDIDATES = 150
const MAX_HITS_PER_WORK = 2
/** Each perspective's own lists: nearest passages per language, and passages by words. */
const PERSPECTIVE_LIST_CANDIDATES = 40
/** The best fused passages of a perspective among which its hits are chosen. */
const PERSPECTIVE_POOL = 20
export const LIBRARY_SEARCH_MAX_PER_PERSPECTIVE = 4
/** The lists by perspective are spread over this many statements run side by side. */
const PERSPECTIVE_STATEMENTS = 3
const OTHER_LANGUAGE_WEIGHT = 0.85
const RRF_K = 60
const SNIPPET_CHARACTERS = 700
/** The assistant preloads up to 25 hits before its first model call. */
export const LIBRARY_SEARCH_MAX_LIMIT = 25
export const LIBRARY_SEARCH_MAX_SECTIONS = 10
/** A longer section is given as the passage found with the one before and after it. */
export const LIBRARY_SECTION_MAX_CHARACTERS = 6000

/** The key of a passage is its section's key followed by `#` and its part number. */
const sectionOf = (passageKey: string) => passageKey.replace(/#\d+$/u, '')
const snippetOf = (content: string) =>
  content.length > SNIPPET_CHARACTERS
    ? `${content.slice(0, content.lastIndexOf(' ', SNIPPET_CHARACTERS))} …`
    : content

/**
 * The text of each of the best hits' sections: the whole section when it fits, otherwise the
 * passage found with its neighbours, marked as cut with an ellipsis. Single-passage sections are
 * left out: their passage is already the section.
 */
async function sectionTexts(
  database: Kysely<ResourceDatabase>,
  rows: readonly { publication_id: number; passage_key: string }[]
) {
  const texts = new Map<string, string>()
  if (!rows.length) return texts
  const siblings = await sql<{
    publication_id: number
    passage_key: string
    part: number
    content: string
  }>`
    select publication_id, passage_key, part, content from library_passages where ${sql.join(
      rows.map(
        row =>
          sql`(publication_id = ${row.publication_id} and starts_with(passage_key, ${`${sectionOf(row.passage_key)}#`}))`
      ),
      sql` or `
    )}`.execute(database)
  for (const row of rows) {
    const section = sectionOf(row.passage_key)
    const parts = siblings.rows
      .filter(
        item =>
          item.publication_id === row.publication_id && sectionOf(item.passage_key) === section
      )
      .sort((left, right) => left.part - right.part)
    if (parts.length < 2) continue
    const total = parts.reduce((sum, item) => sum + item.content.length, 0)
    const index = parts.findIndex(item => item.passage_key === row.passage_key)
    const kept =
      total <= LIBRARY_SECTION_MAX_CHARACTERS
        ? parts
        : parts.slice(Math.max(0, index - 1), index + 2)
    texts.set(
      `${row.publication_id}:${row.passage_key}`,
      `${kept[0] === parts[0] ? '' : '… '}${kept.map(item => item.content).join('\n')}${kept.at(-1) === parts.at(-1) ? '' : ' …'}`
    )
  }
  return texts
}

type Candidate = { publication_id: number; passage_key: string }
type PassageRow = {
  publication_id: number
  passage_key: string
  corpus: LibraryCorpus
  language: LibraryLanguage
  work: string
  work_title: string
  tradition: string | null
  tags: string[]
  title: string
  book: number | null
  chapter: number | null
  verse_start: number | null
  verse_end: number | null
  content: string
  target: Record<string, string | number>
}

const scopeFilter = (input: LibrarySearchInput) => {
  const conditions = [sql`true`]
  const corpora = input.corpora?.filter(corpus => LIBRARY_CORPORA.includes(corpus))
  if (corpora?.length) conditions.push(sql`corpus in (${sql.join(corpora)})`)
  if (input.works?.length) conditions.push(sql`work in (${sql.join([...input.works])})`)
  // Works the caller leaves out, unless it also names them.
  const unnamed = (input.excludeWorks ?? []).filter(work => !input.works?.includes(work))
  if (unnamed.length) conditions.push(sql`work not in (${sql.join(unnamed)})`)
  if (input.traditions?.length) {
    const patterns = input.traditions.map(tradition => `%${tradition.replace(/[%_\\]/gu, '')}%`)
    conditions.push(
      sql`(tradition ilike any(${sql.val(patterns)}::text[]) or exists (
        select 1 from jsonb_array_elements_text(tags) tag where tag ilike any(${sql.val(patterns)}::text[])))`
    )
  }
  if (input.book) conditions.push(sql`book = ${input.book}`)
  if (input.book && input.chapter) conditions.push(sql`chapter = ${input.chapter}`)
  return sql.join(conditions, sql` and `)
}

// Words of a question that say nothing about its subject, in the three response languages.
const FUNCTION_WORDS = new Set(
  (
    'le la les l un une des du de d et ou en au aux a que qui quoi quel quelle quels quelles dans sur sous pour par avec sans ce cet cette ces se sa son ses leur leurs mon ma mes ton ta tes nous vous ils elles il elle on je tu me te lui y est sont etre ete fait faire dit dire dits peut peux comment pourquoi quand ou donc mais ne pas plus selon entre vers chez tout tous toute toutes bible biblique bibliques ' +
    'the a an of and or in on at to for with without by from is are was were be been does do did say says said what which who whom why how when where about into than this that these those it its his her their our your my me we you they he she bible biblical scripture ' +
    'el los las del al y o en con sin por para que quien como cuando donde es son dice decir sobre una uno unos unas su sus biblia biblico'
  ).split(' ')
)

/** The significant words of a question; the lexical search matches any of them. */
export const lexicalKeywords = (query: string) =>
  [
    ...new Set(
      query
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/gu, '')
        .toLowerCase()
        .split(/[^\p{L}\p{N}]+/u)
        .filter(word => word.length >= 3 && !FUNCTION_WORDS.has(word))
    ),
  ].slice(0, 12)

/**
 * Frequent words are left to the search by meaning: ranking reads every matching passage, and
 * on 2026-11-07 the 77,000 passages holding « testament » took 3 s, and 15,000 passages up to
 * 6.5 s on a cold Neon cache. The words kept, rarest first, may match about 3,000 passages.
 */
const LEXICAL_MATCH_BUDGET = 3_000
/** library_lexemes holds the lexemes of more passages than this; the others are rarer. */
export const LIBRARY_LEXEME_MINIMUM_PASSAGES = 300

/** The rarest lexemes of a language within the budget, as an OR tsquery, or null. */
export const rareLexemeQuery = (lexemes: readonly string[], counts: Record<string, number>) => {
  const ranked = [...new Set(lexemes)]
    .map(lexeme => ({ lexeme, passages: counts[lexeme] ?? LIBRARY_LEXEME_MINIMUM_PASSAGES / 2 }))
    .sort((a, b) => a.passages - b.passages)
  const kept: string[] = []
  let total = 0
  for (const { lexeme, passages } of ranked) {
    if (total + passages > LEXICAL_MATCH_BUDGET) break
    kept.push(lexeme)
    total += passages
  }
  return kept.length ? kept.map(lexeme => `'${lexeme.replace(/'/gu, "''")}'`).join(' | ') : null
}

type LexicalQueries = { fr: string | null; en: string | null }

/** The rarest lexemes of the query's significant words in each searched language, or null. */
async function lexicalQueries(
  database: Kysely<ResourceDatabase>,
  query: string,
  languages: readonly LibraryLanguage[]
): Promise<LexicalQueries | null> {
  const keywords = lexicalKeywords(query)
  if (!keywords.length) return null
  // The lexemes of each language, and how many passages hold the frequent ones, in one call.
  const { rows } = await sql<{ fr: string[]; en: string[]; counts: Record<string, number> }>`
    with stems as (
      select tsvector_to_array(to_tsvector('french', ${keywords.join(' ')})) as fr,
        tsvector_to_array(to_tsvector('english', ${keywords.join(' ')})) as en
    )
    select stems.fr, stems.en, coalesce((
      select json_object_agg(lexeme, passages) from library_lexemes
      where lexeme = any(stems.fr || stems.en)), '{}') as counts
    from stems`.execute(database)
  const stems = rows[0]
  if (!stems) return null
  const queries = {
    fr: languages.includes('fr') ? rareLexemeQuery(stems.fr, stems.counts) : null,
    en: languages.includes('en') ? rareLexemeQuery(stems.en, stems.counts) : null,
  }
  return queries.fr || queries.en ? queries : null
}

const lexicalMatch = (queries: LexicalQueries) => ({
  match: sql.join(
    (['fr', 'en'] as const)
      .filter(language => queries[language])
      .map(language => sql`(language = ${language} and search_vector @@ ${queries[language]}::tsquery)`),
    sql` or `
  ),
  // The terms are bound values, so the planner sees them and walks the GIN index.
  rank: sql`ts_rank_cd(search_vector, case when language = 'fr' then ${queries.fr ?? ''}::tsquery else ${queries.en ?? ''}::tsquery end, 32)`,
})

/** Passages holding the rarest significant words of the query, best ranked first. */
async function searchByWords(
  database: Kysely<ResourceDatabase>,
  queries: LexicalQueries,
  scope: RawBuilder<unknown>,
  candidates: number
): Promise<Candidate[]> {
  const { match, rank } = lexicalMatch(queries)
  const result = await sql<Candidate>`
    select publication_id, passage_key
    from library_passages
    where ${scope} and (${match})
    order by ${rank} desc
    limit ${candidates}`.execute(database)
  return result.rows
}

/** The same, ranked within each perspective: the best `candidates` passages of every one. */
async function searchByWordsPerPerspective(
  database: Kysely<ResourceDatabase>,
  queries: LexicalQueries,
  scope: RawBuilder<unknown>,
  candidates: number,
  perspective: RawBuilder<unknown>
): Promise<(Candidate & { perspective: LibraryPerspective })[]> {
  const { match, rank } = lexicalMatch(queries)
  const result = await sql<Candidate & { perspective: LibraryPerspective }>`
    select publication_id, passage_key, perspective from (
      select publication_id, passage_key, perspective,
        row_number() over (partition by perspective order by rank desc) as position
      from (
        select publication_id, passage_key, ${perspective} as perspective, ${rank} as rank
        from library_passages
        where ${scope} and (${match})
      ) matched
      where perspective is not null
    ) ranked
    where position <= ${candidates}
    order by perspective, position`.execute(database)
  return result.rows
}

const identityOf = (row: PassageRow) => {
  const target = row.target
  if (row.corpus === 'commentary')
    return `commentary:${row.work}:${row.book}:${row.chapter}:${row.verse_start}:${row.verse_end}`
  if (row.corpus === 'dictionary') return `dictionary:${row.work}:${target.entryId}`
  if (row.corpus === 'nave') return `nave:${target.normalizedName}`
  if (row.corpus === 'timeline') return `timeline:${target.slug}`
  if (row.corpus === 'document') return `document:${row.work}:${target.documentKey}`
  return `entity:${target.uniqueName}`
}

type Ranked = { candidate: Candidate; score: number; semantic: boolean; lexical: boolean }

/** Reciprocal rank fusion of lists by meaning (one per language, the reader's first) and by words. */
function fuse(vectorLists: readonly Candidate[][], lexicalRows: readonly Candidate[]): Ranked[] {
  const fused = new Map<string, Ranked>()
  const add = (rows: readonly Candidate[], kind: 'semantic' | 'lexical', weight = 1) =>
    rows.forEach((candidate, rank) => {
      const key = `${candidate.publication_id}:${candidate.passage_key}`
      const entry = fused.get(key) ?? { candidate, score: 0, semantic: false, lexical: false }
      entry.score += weight / (RRF_K + rank + 1)
      entry[kind] = true
      fused.set(key, entry)
    })
  // The reader's language keeps an edge over the other one.
  vectorLists.forEach((rows, index) => add(rows, 'semantic', index === 0 ? 1 : OTHER_LANGUAGE_WEIGHT))
  add(lexicalRows, 'lexical')
  return [...fused.values()].sort((a, b) => b.score - a.score)
}

type Chosen = { row: PassageRow; entry: Ranked }

/** One hit per resource, best first; the reader's language wins over a better score in the other one. */
function byResource(
  ranked: readonly Ranked[],
  rows: ReadonlyMap<string, PassageRow>,
  languages: readonly LibraryLanguage[]
): Chosen[] {
  const chosen = new Map<string, Chosen>()
  for (const entry of ranked) {
    const row = rows.get(`${entry.candidate.publication_id}:${entry.candidate.passage_key}`)
    if (!row) continue
    const identity = identityOf(row)
    const current = chosen.get(identity)
    if (!current) chosen.set(identity, { row, entry })
    else if (languages.indexOf(row.language) < languages.indexOf(current.row.language))
      chosen.set(identity, {
        row,
        entry: { ...entry, score: Math.max(entry.score, current.entry.score) },
      })
  }
  return [...chosen.values()].sort((a, b) => b.entry.score - a.entry.score)
}

/** The hits of one perspective: one per work first, then a second one of a work. */
function perspectiveSelection(ordered: readonly Chosen[], count: number): Chosen[] {
  const selected: Chosen[] = []
  const perWork = new Map<string, number>()
  for (const pass of [1, MAX_HITS_PER_WORK])
    for (const item of ordered) {
      if (selected.length >= count) break
      const used = perWork.get(item.row.work) ?? 0
      if (selected.includes(item) || used >= pass) continue
      perWork.set(item.row.work, used + 1)
      selected.push(item)
    }
  return selected.sort((a, b) => b.entry.score - a.entry.score)
}

export async function searchLibrary(
  database: Kysely<ResourceDatabase>,
  provider: LibraryEmbeddingProvider,
  input: LibrarySearchInput
): Promise<LibrarySearchResult> {
  const query = input.query.replace(/\s+/gu, ' ').trim().slice(0, 500)
  const limit = Math.min(LIBRARY_SEARCH_MAX_LIMIT, Math.max(1, input.limit ?? 6))
  const perPerspective = Math.min(
    LIBRARY_SEARCH_MAX_PER_PERSPECTIVE,
    Math.max(0, input.perPerspective ?? 0)
  )
  const languages = input.languages?.length
    ? [...input.languages]
    : (['fr', 'en'] as LibraryLanguage[])
  const timings = { embeddingMs: 0, vectorMs: 0, lexicalMs: 0 }
  const scope = scopeFilter(input)
  const candidates = input.perspectives ? PERSPECTIVE_CANDIDATES : CANDIDATES
  // The search by perspective: the works of each one, its own exclusions, and only labelled
  // documents where asked. The works are read while the query is embedded.
  const labelled = (input.labelledDocuments ?? []).filter(item => LIBRARY_PERSPECTIVES.includes(item))
  const byPerspectiveScope = perPerspective
    ? perspectiveWorks(database).then(works => {
        const worksOf = (perspective: LibraryPerspective, language?: LibraryLanguage) =>
          language
            ? (works.get(perspective)?.get(language) ?? [])
            : [...(works.get(perspective)?.values() ?? [])].flat()
        const present = LIBRARY_PERSPECTIVES.filter(perspective => worksOf(perspective).length)
        if (!present.length) return null
        const labelledWorks = labelled.flatMap(perspective => worksOf(perspective))
        return {
          worksOf,
          present,
          scope: sql`${scopeFilter({ ...input, excludeWorks: input.perspectiveExcludeWorks ?? input.excludeWorks })} and ${
            labelledWorks.length
              ? sql`(corpus <> 'document' or target ? 'labels' or work not in (${sql.join(labelledWorks)}))`
              : sql`true`
          }`,
          perspective: sql`(case ${sql.join(
            present.map(perspective => sql`when work in (${sql.join(worksOf(perspective))}) then ${sql.lit(perspective)}`),
            sql` `
          )} end)`,
        }
      })
    : Promise.resolve(null)
  byPerspectiveScope.catch(() => undefined)

  let embedding: number[] | undefined
  // The search by words does not wait for the query embedding.
  const lexicalStarted = Date.now()
  const stems = lexicalQueries(database, query, languages)
  const lexical = stems
    .then(queries => (queries ? searchByWords(database, queries, scope, candidates) : []))
    .then(rows => {
      timings.lexicalMs = Date.now() - lexicalStarted
      return rows
    })
  const perspectiveLexical = Promise.all([stems, byPerspectiveScope]).then(([queries, search]) =>
    queries && search
      ? searchByWordsPerPerspective(database, queries, search.scope, PERSPECTIVE_LIST_CANDIDATES, search.perspective)
      : []
  )
  // Their failure is thrown where they are awaited, after the search by meaning.
  lexical.catch(() => undefined)
  perspectiveLexical.catch(() => undefined)
  const embeddingStarted = Date.now()
  try {
    embedding = await provider.embedQuery(query)
  } catch {
    // Words alone still find passages when the embedding model does not answer.
  }
  timings.embeddingMs = Date.now() - embeddingStarted
  const perspectiveSearch = await byPerspectiveScope

  const vectorStarted = Date.now()
  // One list per language: a question is nearer to passages in its own language, and the works
  // published in the other language only (the BRI articles, Calvin) would never reach the pool.
  // The search by perspective adds one list per perspective and language, in the same statement.
  const lists = [
    ...languages.map(language => ({ language, perspective: '', scope, limit: candidates })),
    // A perspective without a work in a language has no list in it: an empty filter would walk
    // the whole index.
    ...(perspectiveSearch
      ? perspectiveSearch.present.flatMap(perspective =>
          languages
            .filter(language => perspectiveSearch.worksOf(perspective, language).length)
            .map(language => ({
              language,
              perspective,
              scope: sql`${perspectiveSearch.scope} and work in (${sql.join(perspectiveSearch.worksOf(perspective, language))})`,
              limit: PERSPECTIVE_LIST_CANDIDATES,
            }))
        )
      : []),
  ]
  type VectorRow = Candidate & { distance: number; language: LibraryLanguage; list: string }
  type VectorList = (typeof lists)[number]
  const vectorStatement = (statement: readonly VectorList[]) =>
    database.transaction().execute(async transaction => {
      // Filters apply after the graph walk: iterative scans keep walking until enough rows pass.
      await sql`set local hnsw.ef_search = ${sql.lit(Math.max(100, candidates))}`.execute(transaction)
      await sql`set local hnsw.iterative_scan = relaxed_order`.execute(transaction)
      const vector = vectorLiteral(embedding!)
      const result = await sql<VectorRow>`
        ${sql.join(
          statement.map(
            list => sql`(select publication_id, passage_key, language, ${sql.lit(list.perspective)} as list,
                embedding <=> ${vector}::halfvec as distance
              from library_passages
              where language = ${list.language} and ${list.scope}
              order by embedding <=> ${vector}::halfvec
              limit ${list.limit})`
          ),
          sql` union all `
        )}`.execute(transaction)
      return result.rows
    })
  // The lists by perspective run beside the plain ones, in a few statements on their own
  // connections: one statement runs its lists one after the other.
  const perspectiveLists = lists.filter(list => list.perspective)
  const statements = [
    lists.filter(list => !list.perspective),
    ...Array.from({ length: PERSPECTIVE_STATEMENTS }, (_, index) =>
      perspectiveLists.filter((_, position) => position % PERSPECTIVE_STATEMENTS === index)
    ),
  ].filter(statement => statement.length)
  const vectorRows: VectorRow[] = embedding
    ? (await Promise.all(statements.map(vectorStatement))).flat()
    : []
  timings.vectorMs = Date.now() - vectorStarted
  // Relaxed order may return neighbours slightly out of order.
  const vectorLists = (perspective: string) =>
    languages.map(language =>
      vectorRows
        .filter(row => row.list === perspective && row.language === language)
        .sort((a, b) => a.distance - b.distance)
    )

  const ranked = fuse(vectorLists(''), await lexical)
  const perspectiveWords = await perspectiveLexical
  const pools = perspectiveSearch
    ? LIBRARY_PERSPECTIVES.map(perspective => ({
        perspective,
        ranked: fuse(
          vectorLists(perspective),
          perspectiveWords.filter(row => row.perspective === perspective)
        ).slice(0, PERSPECTIVE_POOL),
      }))
    : []
  const wanted = [...ranked, ...pools.flatMap(pool => pool.ranked)]
  if (!wanted.length)
    return {
      hits: [],
      ...(perPerspective ? { perspectiveHits: [] } : {}),
      semantic: Boolean(embedding),
      timings,
    }

  const passages = (await database
    .selectFrom('library_passages')
    .select([
      'publication_id',
      'passage_key',
      'corpus',
      'language',
      'work',
      'work_title',
      'tradition',
      'tags',
      'title',
      'book',
      'chapter',
      'verse_start',
      'verse_end',
      'content',
      'target',
    ])
    .where(eb =>
      eb.or(
        [...new Map(wanted.map(entry => [`${entry.candidate.publication_id}:${entry.candidate.passage_key}`, entry])).values()].map(entry =>
          eb.and([
            eb('publication_id', '=', entry.candidate.publication_id),
            eb('passage_key', '=', entry.candidate.passage_key),
          ])
        )
      )
    )
    .execute()) as PassageRow[]
  const rows = new Map(passages.map(row => [`${row.publication_id}:${row.passage_key}`, row]))

  const ordered = byResource(ranked, rows, languages)
  // At most two hits a work: a large work (tens of thousands of passages) does
  // not fill the answer, and the other works of its tradition get their turn.
  const perWork = new Map<string, number>()
  let selected = ordered
    .filter(item => {
      const count = perWork.get(item.row.work) ?? 0
      perWork.set(item.row.work, count + 1)
      return count < MAX_HITS_PER_WORK
    })
    .slice(0, limit)
  if (input.perspectives) {
    // The best passage of each perspective, then the next best ones, one per work.
    const perspectives = new Set<LibraryPerspective>()
    const works = new Set<string>()
    selected = []
    for (const item of ordered) {
      const perspective = perspectiveOf(item.row.tradition, item.row.tags)
      if (selected.length >= limit || perspectives.has(perspective)) continue
      perspectives.add(perspective)
      works.add(item.row.work)
      selected.push(item)
    }
    for (const item of ordered) {
      if (selected.length >= limit) break
      if (selected.includes(item) || works.has(item.row.work)) continue
      works.add(item.row.work)
      selected.push(item)
    }
    selected.sort((a, b) => b.entry.score - a.entry.score)
  }
  const byPerspective = pools.map(pool =>
    perspectiveSelection(byResource(pool.ranked, rows, languages), perPerspective)
  )
  // The best hits by score carry their whole section, and the first ones of each perspective.
  const sections = input.fullText
    ? await sectionTexts(database, [
        ...[...selected]
          .sort((left, right) => right.entry.score - left.entry.score)
          .slice(0, Math.min(LIBRARY_SEARCH_MAX_SECTIONS, Math.max(0, input.sections ?? 0))),
        ...byPerspective.flatMap(items =>
          items.slice(0, Math.min(perPerspective, Math.max(0, input.perspectiveSections ?? 0)))
        ),
      ].map(({ row }) => row))
    : new Map<string, string>()
  const sectioned = new Set(
    byPerspective.flatMap(items =>
      items.slice(0, Math.max(0, input.perspectiveSections ?? 0)).map(item => item.row)
    )
  )
  const mainSectioned = new Set(
    [...selected]
      .sort((left, right) => right.entry.score - left.entry.score)
      .slice(0, Math.min(LIBRARY_SEARCH_MAX_SECTIONS, Math.max(0, input.sections ?? 0)))
      .map(item => item.row)
  )
  const hitOf = ({ row, entry }: Chosen, withSection: boolean): LibrarySearchHit => ({
    corpus: row.corpus,
    language: row.language,
    work: row.work,
    workTitle: row.work_title,
    tradition: row.tradition,
    tags: row.tags,
    title: row.title,
    reference:
      row.book && row.chapter
        ? {
            book: row.book,
            chapter: row.chapter,
            verseStart: row.verse_start,
            verseEnd: row.verse_end,
          }
        : null,
    snippet: snippetOf(row.content),
    ...(input.fullText
      ? {
          text:
            (withSection && sections.get(`${row.publication_id}:${row.passage_key}`)) ||
            row.content,
        }
      : {}),
    target: row.target,
    score: Math.round(entry.score * 10_000) / 10_000,
    matched: entry.semantic && entry.lexical ? 'both' : entry.semantic ? 'semantic' : 'lexical',
    perspective: perspectiveOf(row.tradition, row.tags),
  })
  return {
    hits: selected.map(item => hitOf(item, mainSectioned.has(item.row))),
    ...(perPerspective
      ? {
          perspectiveHits: byPerspective.flatMap(items =>
            items.map(item => hitOf(item, sectioned.has(item.row)))
          ),
        }
      : {}),
    semantic: Boolean(embedding),
    timings,
  }
}
