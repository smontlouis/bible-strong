// Hybrid search over the library index (ADR-0103): nearest passages by meaning (HNSW on the
// half-precision vectors) and by words (the lexical vector of each passage's language), fused
// by reciprocal rank. One hit per resource: the best passage of a commentary section, a
// dictionary article or a profile, in the first requested language when both exist.
import { sql, type Kysely } from 'kysely'

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
  /** Matched against the tradition and the tags of a work, such as "Adventiste" or "Réformé". */
  traditions?: readonly string[]
  works?: readonly string[]
  book?: number
  chapter?: number
  limit?: number
  /**
   * One hit per perspective first (ADR-0106): on a debated point the best passage of each
   * tradition, then one more per work, rather than the nearest passages of the largest one.
   */
  perspectives?: boolean
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
  if (words.includes('adventiste')) return 'adventist'
  if (/catholi|thomiste|scolastique/u.test(words)) return 'catholic'
  if (/christianisme ancien|patristique/u.test(words)) return 'patristic'
  if (/judaisme|rabbinique/u.test(words)) return 'jewish'
  if (/dispensational|freres|evangelique|baptiste|restaurationniste|pentecot/u.test(words))
    return 'evangelical'
  return 'protestant'
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
  target: Record<string, string | number>
  score: number
  matched: 'semantic' | 'lexical' | 'both'
  perspective: LibraryPerspective
}

export type LibrarySearchResult = {
  hits: LibrarySearchHit[]
  semantic: boolean
  timings: { embeddingMs: number; vectorMs: number; lexicalMs: number }
}

/** Deep enough that a large work leaves room for the others once capped (two hits a work). */
const CANDIDATES = 100
/** A search by perspective looks further, so that smaller traditions reach the selection. */
const PERSPECTIVE_CANDIDATES = 150
const MAX_HITS_PER_WORK = 2
const OTHER_LANGUAGE_WEIGHT = 0.85
const RRF_K = 60
const SNIPPET_CHARACTERS = 700
export const LIBRARY_SEARCH_MAX_LIMIT = 10

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

/** Passages holding the rarest significant words of the query, best ranked first. */
async function searchByWords(
  database: Kysely<ResourceDatabase>,
  query: string,
  languages: readonly LibraryLanguage[],
  scope: ReturnType<typeof scopeFilter>,
  candidates: number
): Promise<Candidate[]> {
  const keywords = lexicalKeywords(query)
  if (!keywords.length) return []
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
  if (!stems) return []
  const queries = {
    fr: languages.includes('fr') ? rareLexemeQuery(stems.fr, stems.counts) : null,
    en: languages.includes('en') ? rareLexemeQuery(stems.en, stems.counts) : null,
  }
  const branches = (['fr', 'en'] as const)
    .filter(language => queries[language])
    .map(language => sql`(language = ${language} and search_vector @@ ${queries[language]}::tsquery)`)
  if (!branches.length) return []
  // The terms are bound values, so the planner sees them and walks the GIN index.
  const rank = sql`ts_rank_cd(search_vector, case when language = 'fr' then ${queries.fr ?? ''}::tsquery else ${queries.en ?? ''}::tsquery end, 32)`
  const result = await sql<Candidate>`
    select publication_id, passage_key
    from library_passages
    where ${scope} and (${sql.join(branches, sql` or `)})
    order by ${rank} desc
    limit ${candidates}`.execute(database)
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

export async function searchLibrary(
  database: Kysely<ResourceDatabase>,
  provider: LibraryEmbeddingProvider,
  input: LibrarySearchInput
): Promise<LibrarySearchResult> {
  const query = input.query.replace(/\s+/gu, ' ').trim().slice(0, 500)
  const limit = Math.min(LIBRARY_SEARCH_MAX_LIMIT, Math.max(1, input.limit ?? 6))
  const languages = input.languages?.length
    ? [...input.languages]
    : (['fr', 'en'] as LibraryLanguage[])
  const timings = { embeddingMs: 0, vectorMs: 0, lexicalMs: 0 }
  const scope = scopeFilter(input)
  const candidates = input.perspectives ? PERSPECTIVE_CANDIDATES : CANDIDATES

  let embedding: number[] | undefined
  // The search by words does not wait for the query embedding.
  const lexicalStarted = Date.now()
  const lexical = searchByWords(database, query, languages, scope, candidates).then(rows => {
    timings.lexicalMs = Date.now() - lexicalStarted
    return rows
  })
  // Its failure is thrown where it is awaited, after the search by meaning.
  lexical.catch(() => undefined)
  const embeddingStarted = Date.now()
  try {
    embedding = await provider.embedQuery(query)
  } catch {
    // Words alone still find passages when the embedding model does not answer.
  }
  timings.embeddingMs = Date.now() - embeddingStarted

  const vectorStarted = Date.now()
  // One list per language: a question is nearer to passages in its own language, and the works
  // published in the other language only (the BRI articles, Calvin) would never reach the pool.
  const vectorLists: Candidate[][] = embedding
    ? await database.transaction().execute(async transaction => {
        // Filters apply after the graph walk: iterative scans keep walking until enough rows pass.
        await sql`set local hnsw.ef_search = ${sql.lit(Math.max(100, candidates))}`.execute(transaction)
        await sql`set local hnsw.iterative_scan = relaxed_order`.execute(transaction)
        const vector = vectorLiteral(embedding!)
        const result = await sql<Candidate & { distance: number; language: LibraryLanguage }>`
          ${sql.join(
            languages.map(
              language => sql`(select publication_id, passage_key, language,
                  embedding <=> ${vector}::halfvec as distance
                from library_passages
                where language = ${language} and ${scope}
                order by embedding <=> ${vector}::halfvec
                limit ${candidates})`
            ),
            sql` union all `
          )}`.execute(transaction)
        // Relaxed order may return neighbours slightly out of order.
        return languages.map(language =>
          result.rows
            .filter(row => row.language === language)
            .sort((a, b) => a.distance - b.distance)
        )
      })
    : []
  timings.vectorMs = Date.now() - vectorStarted

  const lexicalRows = await lexical

  const fused = new Map<
    string,
    { candidate: Candidate; score: number; semantic: boolean; lexical: boolean }
  >()
  const add = (rows: Candidate[], kind: 'semantic' | 'lexical', weight = 1) =>
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
  if (!fused.size) return { hits: [], semantic: Boolean(embedding), timings }

  type Ranked = { candidate: Candidate; score: number; semantic: boolean; lexical: boolean }
  const ranked: Ranked[] = [...fused.values()].sort((a, b) => b.score - a.score)
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
        ranked.map(entry =>
          eb.and([
            eb('publication_id', '=', entry.candidate.publication_id),
            eb('passage_key', '=', entry.candidate.passage_key),
          ])
        )
      )
    )
    .execute()) as PassageRow[]
  const rows = new Map(passages.map(row => [`${row.publication_id}:${row.passage_key}`, row]))

  // One hit per resource; the reader's language wins over a better score in the other one.
  const chosen = new Map<string, { row: PassageRow; entry: Ranked }>()
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

  const ordered = [...chosen.values()].sort((a, b) => b.entry.score - a.entry.score)
  // At most two hits a work: a large work (70,000 passages of Ellen G. White's writings) does
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
  const hits = selected
    .map(
      ({ row, entry }): LibrarySearchHit => ({
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
        snippet:
          row.content.length > SNIPPET_CHARACTERS
            ? `${row.content.slice(0, row.content.lastIndexOf(' ', SNIPPET_CHARACTERS))} …`
            : row.content,
        target: row.target,
        score: Math.round(entry.score * 10_000) / 10_000,
        matched: entry.semantic && entry.lexical ? 'both' : entry.semantic ? 'semantic' : 'lexical',
        perspective: perspectiveOf(row.tradition, row.tags),
      })
    )
  return { hits, semantic: Boolean(embedding), timings }
}
