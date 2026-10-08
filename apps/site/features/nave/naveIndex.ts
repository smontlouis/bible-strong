import type { NaveTopicListResponseDto } from '@bible-strong/resource-domain/contracts/naveContract'
import type { ResourceLanguage } from '../resources/publicSite'
import { readResource } from '../resources/resourceApi'
import { answerShared, notingStaleAnswers, type NotedAnswer } from '../resources/staleAnswers'
import { NAVE_LETTERS } from './naveRoutes'

export type NaveIndexTopic = {
  normalizedName: string
  name: string
  /** The letter the topic is filed under. */
  letter: string
}

export type NaveIndex = {
  /** Every listed topic: letter after letter, each in the alphabetical order of the language. */
  topics: readonly NaveIndexTopic[]
  /** The topics of each letter that has some. */
  byLetter: ReadonlyMap<string, readonly NaveIndexTopic[]>
  /** The position in `topics` of each `normalizedName`. */
  positions: ReadonlyMap<string, number>
}

// The Resource API returns at most this many topics per request.
const REQUEST_LIMIT = 500
// The largest letter holds under six hundred topics; the cap only guards a cursor loop.
const MAX_LETTER_REQUESTS = 10
const INDEX_TTL_MS = 60 * 60 * 1000

const readLetter = async (language: ResourceLanguage, letter: string) => {
  const topics: NaveTopicListResponseDto['topics'][number][] = []
  let cursor: string | undefined
  for (let request = 0; request < MAX_LETTER_REQUESTS; request += 1) {
    const response = await readResource<NaveTopicListResponseDto>(`/v1/naves/${language}/topics`, {
      initial: letter,
      limit: REQUEST_LIMIT,
      cursor,
    })
    topics.push(...(response?.topics ?? []))
    cursor = response?.nextCursor
    if (!cursor) break
  }
  return topics
}

const readIndex = async (language: ResourceLanguage): Promise<NaveIndex> => {
  // A publication files its topics under the plain initial of their name (`Éternité` under
  // `e`), so the letters are read side by side and cover every topic.
  const lists = await Promise.all(NAVE_LETTERS.map(letter => readLetter(language, letter)))
  // The Resource API lists accented names after `z`; a reader expects them with their letter.
  const collator = new Intl.Collator(language, { sensitivity: 'base' })
  const byLetter = new Map<string, NaveIndexTopic[]>()
  NAVE_LETTERS.forEach((letter, position) => {
    const topics = (lists[position] ?? [])
      .map(topic => ({ normalizedName: topic.normalizedName, name: topic.name, letter }))
      .sort(
        (left, right) =>
          collator.compare(left.name, right.name) ||
          left.normalizedName.localeCompare(right.normalizedName)
      )
    if (topics.length) byLetter.set(letter, topics)
  })
  const topics = [...byLetter.values()].flat()
  const positions = new Map(topics.map((topic, position) => [topic.normalizedName, position]))
  return { topics, byLetter, positions }
}

const cache = new Map<ResourceLanguage, { at: number; index: Promise<NotedAnswer<NaveIndex>> }>()

/**
 * The topics of a publication, without their content. Lists, cross-reference checks and
 * sitemaps all read it, so a server instance keeps it an hour.
 */
export const loadNaveIndex = (language: ResourceLanguage): Promise<NaveIndex> => {
  const cached = cache.get(language)
  const read = () => readIndex(language)
  if (cached && Date.now() - cached.at < INDEX_TTL_MS) return answerShared(cached.index, read)
  const index = notingStaleAnswers(read)
  cache.set(language, { at: Date.now(), index })
  const forget = () => {
    if (cache.get(language)?.index === index) cache.delete(language)
  }
  // A failed read is not kept: the next request tries again. Nor is an index a STALE answer
  // of the Resource API came into: each page that was sharing the read then reads again.
  index.then(({ stale }) => {
    if (stale) forget()
  }, forget)
  return index.then(({ value }) => value)
}
