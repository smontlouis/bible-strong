// The library's vectors in Cloudflare Vectorize (ADR-0103, amendment of 2026-11-12): the nearest
// passages by meaning without the HNSW index of Neon, which no longer fits its file cache. Neon
// keeps the passages, the search by words and the publications; Vectorize holds one vector per
// passage, the same Qwen vector, with the fields the lists filter on.
//
// - One index per language. In a shared index, a list in the other language than the question
//   lost its nearest passages: the approximate search explores the regions nearest the query,
//   which hold passages in its own language, and a namespace or filter only then keeps the others.
// - Indexed metadata (created before any vector, at most 10): work, corpus, perspective, book,
//   chapter, labelled (false for a document passage without labels) and bucket (0 or 1, from a
//   hash), which splits a list deeper than Vectorize's topK of 100 into two queries.
// - Identifier: `<publication id>:<passage key>`, at most 64 bytes. A longer key (3,877 passages
//   on 2026-11-12, long document slugs) becomes `<publication id>:<start of the key>~<hash>`: the
//   repository finds it among the keys of its publication that start alike, in the query that
//   reads the passages anyway.
// The perspective of a passage is stored, but the lists filter on works as the pgvector ones do,
// so a change of `perspectiveOf` needs no new vectors.
import { createHash } from 'node:crypto'

import type { LibraryCorpus, LibraryLanguage } from './libraryDocuments'
import type { LibraryPerspective } from './libraryPerspectives'

export const LIBRARY_VECTOR_INDEX_NAMES: Record<LibraryLanguage, string> = {
  fr: 'bible-strong-library-fr',
  en: 'bible-strong-library-en',
}
/** Vectorize returns at most 100 matches without values or metadata, 50 with values. */
export const LIBRARY_VECTORIZE_MAX_TOP_K = 100
export const LIBRARY_VECTORIZE_MAX_PRECISE_TOP_K = 50
const MAX_ID_BYTES = 64
/** Characters of the base64url SHA-256 of a long key kept in its identifier (66 bits). */
export const LIBRARY_VECTOR_KEY_HASH_CHARACTERS = 11
/** Vectorize refuses a filter whose compact JSON reaches 2,048 bytes. */
const MAX_FILTER_BYTES = 2000

/** A condition on one indexed field, in the operators the search uses. */
export type LibraryVectorizeCondition = {
  $eq?: string | number | boolean
  $in?: string[]
  $nin?: string[]
}
export type LibraryVectorizeFilter = Record<string, LibraryVectorizeCondition>

/** The part of a Vectorize binding the search uses; the REST client implements it too. */
export type LibraryVectorizeClient = {
  query(
    vector: number[],
    options: {
      topK: number
      filter?: LibraryVectorizeFilter
      returnMetadata: 'none'
      returnValues?: boolean
    }
  ): Promise<{ matches: readonly { id: string; score: number }[] }>
}

/** What a list keeps, in the terms of the passage fields. */
export type LibraryVectorFilter = {
  /** Only these works; an empty list matches nothing. */
  works?: readonly string[]
  excludeWorks?: readonly string[]
  corpora?: readonly LibraryCorpus[]
  book?: number
  chapter?: number
  /** Leaves out document passages without labels. */
  labelledOnly?: boolean
}

export type LibraryVectorList = {
  language: LibraryLanguage
  limit: number
  filter: LibraryVectorFilter
}

export type LibraryVectorMatch = {
  publication_id: number
  /** The passage key, or for a long one its form in the identifier (libraryVectorKey). */
  key: string
  /** Cosine distance as Vectorize scores it (1 minus its score), from its compressed vectors. */
  distance: number
}

/** The nearest passages of each list, in the order of the lists. */
export type LibraryVectorSearch = {
  nearest(vector: number[], lists: readonly LibraryVectorList[]): Promise<LibraryVectorMatch[][]>
}

const keyHash = (passageKey: string) =>
  createHash('sha256')
    .update(passageKey)
    .digest('base64url')
    .slice(0, LIBRARY_VECTOR_KEY_HASH_CHARACTERS)

/**
 * The passage key as it stands in its identifier: the key itself when the identifier fits 64 bytes
 * and the key holds no `~`, otherwise the longest start of the key that fits, `~` and a hash of the
 * whole key.
 */
export function libraryVectorKey(publicationId: number, passageKey: string) {
  const encoder = new TextEncoder()
  const budget = MAX_ID_BYTES - encoder.encode(`${publicationId}:`).length
  if (!passageKey.includes('~') && encoder.encode(passageKey).length <= budget) return passageKey
  let start = ''
  let bytes = 0
  for (const character of passageKey.split('~')[0]!) {
    bytes += encoder.encode(character).length
    if (bytes > budget - 1 - LIBRARY_VECTOR_KEY_HASH_CHARACTERS) break
    start += character
  }
  return `${start}~${keyHash(passageKey)}`
}

export const libraryVectorId = (publicationId: number, passageKey: string) =>
  `${publicationId}:${libraryVectorKey(publicationId, passageKey)}`

/** A key from an identifier: the passage key, or the start and hash of a long one. */
export function parseLibraryVectorKey(key: string) {
  const separator = key.indexOf('~')
  return separator < 0
    ? { passageKey: key }
    : { start: key.slice(0, separator), hash: key.slice(separator + 1) }
}

/** The half a vector falls in, for the lists deeper than one query can return. */
export const libraryVectorBucket = (publicationId: number, passageKey: string) =>
  createHash('sha256').update(`${publicationId}:${passageKey}`).digest()[0]! & 1

export type LibraryVectorPassage = {
  publication_id: number
  passage_key: string
  language: LibraryLanguage
  work: string
  corpus: LibraryCorpus
  perspective: LibraryPerspective
  book: number | null
  chapter: number | null
  /** False for a document passage without labels (`target.labels`). */
  labelled: boolean
}

/** The record of a passage in the index of its language, without its values. */
export function libraryVectorRecord(passage: LibraryVectorPassage) {
  return {
    id: libraryVectorId(passage.publication_id, passage.passage_key),
    metadata: {
      work: passage.work,
      corpus: passage.corpus,
      perspective: passage.perspective,
      labelled: passage.labelled,
      bucket: libraryVectorBucket(passage.publication_id, passage.passage_key),
      ...(passage.book === null ? {} : { book: passage.book }),
      ...(passage.chapter === null ? {} : { chapter: passage.chapter }),
    },
  }
}

/** The Vectorize filter of a list, or null when it matches nothing. */
export function libraryVectorizeFilter(filter: LibraryVectorFilter): LibraryVectorizeFilter | null {
  const excluded = filter.excludeWorks ?? []
  const works = filter.works?.filter(work => !excluded.includes(work))
  if (works && !works.length) return null
  const result: LibraryVectorizeFilter = {}
  if (works) result.work = { $in: [...works] }
  else if (excluded.length) result.work = { $nin: [...excluded] }
  if (filter.corpora?.length) result.corpus = { $in: [...filter.corpora] }
  if (filter.book) result.book = { $eq: filter.book }
  if (filter.book && filter.chapter) result.chapter = { $eq: filter.chapter }
  if (filter.labelledOnly) result.labelled = { $eq: true }
  if (JSON.stringify(result).length > MAX_FILTER_BYTES)
    throw new Error('LIBRARY_VECTOR_FILTER_TOO_LARGE')
  return result
}

/** The nearest matches of a filter, by score, split by bucket when deeper than one query returns. */
async function nearestMatches(
  client: LibraryVectorizeClient,
  vector: number[],
  filter: LibraryVectorizeFilter,
  limit: number,
  precise: boolean
) {
  const maxTopK = precise ? LIBRARY_VECTORIZE_MAX_PRECISE_TOP_K : LIBRARY_VECTORIZE_MAX_TOP_K
  const halves =
    limit > maxTopK
      ? [{ ...filter, bucket: { $eq: 0 } }, { ...filter, bucket: { $eq: 1 } }]
      : [filter]
  const results = await Promise.all(
    halves.map(half =>
      client.query(vector, {
        topK: Math.min(maxTopK, limit),
        ...(Object.keys(half).length ? { filter: half } : {}),
        returnMetadata: 'none',
        // Scored on the stored vectors rather than their compressed form, at most 50 matches.
        ...(precise ? { returnValues: true } : {}),
      })
    )
  )
  return results.flatMap(result => result.matches).sort((left, right) => right.score - left.score)
}

/**
 * A list in Vectorize. Precise, its first 100 passages are scored on the stored vectors (two
 * queries of 50, one per bucket) and the rest of a deeper list comes from the compressed scores;
 * otherwise every passage comes from the compressed scores. On the assistant's 292 bench questions
 * (2026-11-12), the compressed scores kept 91 % of the exact 10 nearest passages in French and
 * 74 % of the 12 nearest of a perspective in English; the stored vectors, 98 % and 97 %.
 */
async function nearestOfList(
  client: LibraryVectorizeClient,
  vector: number[],
  list: LibraryVectorList,
  precise: boolean
): Promise<LibraryVectorMatch[]> {
  const filter = libraryVectorizeFilter(list.filter)
  if (!filter) return []
  const depth = Math.min(list.limit, 2 * LIBRARY_VECTORIZE_MAX_PRECISE_TOP_K)
  const [first, rest] = await Promise.all([
    nearestMatches(client, vector, filter, precise ? depth : list.limit, precise),
    precise && list.limit > depth
      ? nearestMatches(client, vector, filter, list.limit, false)
      : Promise.resolve([]),
  ])
  const found = new Set(first.map(match => match.id))
  return [...first, ...rest.filter(match => !found.has(match.id))]
    .slice(0, list.limit)
    .map(match => {
      const separator = match.id.indexOf(':')
      return {
        publication_id: Number(match.id.slice(0, separator)),
        key: match.id.slice(separator + 1),
        distance: 1 - match.score,
      }
    })
}

export function makeVectorizeLibrarySearch(
  clients: Record<LibraryLanguage, LibraryVectorizeClient>,
  options: {
    /** Score on the stored vectors (the default); false keeps Vectorize's compressed scores. */
    precise?: boolean
  } = {}
): LibraryVectorSearch {
  return {
    nearest: (vector, lists) =>
      Promise.all(
        lists.map(list =>
          nearestOfList(clients[list.language], vector, list, options.precise ?? true)
        )
      ),
  }
}
