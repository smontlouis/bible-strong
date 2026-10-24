import type { StrongLexiconSearchResponseDto } from '@bible-strong/resource-domain/contracts/strongLexiconContract'
import type { StudyLanguage } from '../language'
import type { ResourceReader } from '../resourceApi'

type FoundEntry = StrongLexiconSearchResponseDto['entries'][number]

const ENTRIES_PATH = '/v1/strong-lexicon/entries'
// What one question reads of each list, and how far the list of a short word is followed.
const PREFIX_PAGE = 30
const SEARCH_PAGE = 100
const WHOLE_SEARCH = 500

const plain = (value: string) =>
  value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim()

/** The word asked for itself, then the words that begin with it, then the ones holding it. */
const rankOf = (entry: FoundEntry, wanted: string): number => {
  const gloss = plain(entry.gloss)
  if (gloss === wanted) return 0
  if (plain(entry.transliteration) === wanted || plain(entry.original) === wanted) return 1
  return gloss.startsWith(wanted) ? 2 : 3
}

/**
 * Finds the entries of the lexicon a word names. The Resource API lists what holds the word
 * in the order of a dictionary, for a person who browses: asked for « foi », « Ruth » or
 * "sin", its first entries are « bonne foi », "be truthful" and "abusing", and the word
 * itself comes dozens of entries later. The entries that begin with the word are therefore
 * read beside the ones that hold it, and the word asked for is put first.
 */
export const findLexiconEntries = async (
  api: ResourceReader,
  input: {
    query: string
    language: StudyLanguage
    originalLanguage?: 'hebrew' | 'greek'
    limit: number
  }
): Promise<FoundEntry[]> => {
  const query = input.query.trim()
  const wanted = plain(query)
  const ask = (by: 'search' | 'prefix', limit: number) =>
    api.get<StrongLexiconSearchResponseDto>(ENTRIES_PATH, {
      language: input.language,
      [by]: query,
      lexicalLanguage: input.originalLanguage,
      limit,
    })

  const [beginning, holding] = await Promise.all([
    // A list that begins with the word is a help, never what the answer depends on.
    ask('prefix', PREFIX_PAGE).catch(() => undefined),
    ask('search', SEARCH_PAGE),
  ])
  let found = [...(beginning?.entries ?? []), ...(holding?.entries ?? [])]
  // The beginning is read with its accents, the rest without: a short word written without
  // its accent (« Eve ») is in neither page, and the whole list is read for it.
  if (holding?.nextCursor && !found.some(entry => rankOf(entry, wanted) < 2)) {
    const whole = await ask('search', WHOLE_SEARCH).catch(() => undefined)
    found = [...found, ...(whole?.entries ?? [])]
  }

  const entries = [...new Map(found.map(entry => [entry.stepCode, entry])).values()]
  return entries
    .map((entry, index) => ({ entry, index, rank: rankOf(entry, wanted) }))
    .sort((left, right) => left.rank - right.rank || left.index - right.index)
    .slice(0, input.limit)
    .map(({ entry }) => entry)
}
