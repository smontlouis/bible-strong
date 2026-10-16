import type { BibleSearchResponseDto } from '@bible-strong/resource-domain/contracts/bibleChapterContract'
import * as z from 'zod/v4'
import { quoteText } from '../bible/layout'
import { formatPassage, parsePassages, passageOsis, type Passage } from '../bible/reference'
import { versionName } from '../bible/versions'
import type { BibleSearchCard, MarkedPart, VerseHit } from '../cards/types'
import type { StudyLanguage } from '../language'
import { languageInput, lines, StudyError, type StudyContext, type StudyResult } from '../study'
import { resolveVersions } from './passage'

const DEFAULT_LIMIT = 10
const MAX_LIMIT = 25

export const searchInput = {
  query: z
    .string()
    .min(1)
    .max(200)
    .describe(
      'Words to find in the Bible text, in the language of the version. Put a phrase between ' +
        'double quotes to find it exactly. With mode "meaning", a question or an idea in plain words.'
    ),
  mode: z
    .enum(['text', 'meaning'])
    .optional()
    .describe(
      '"text" (default) finds verses holding the words, with their spelling variants. ' +
        '"meaning" finds verses about an idea even when they share no word with the query.'
    ),
  version: z
    .string()
    .min(2)
    .max(32)
    .optional()
    .describe('Bible version code to search, such as LSG or KJV. Defaults to LSG in French, KJV in English.'),
  testament: z
    .enum(['old', 'new'])
    .optional()
    .describe('Search only the Old or the New Testament.'),
  book: z
    .string()
    .max(40)
    .optional()
    .describe('Search only one book, by its name: "Romains", "Psalms".'),
  limit: z.number().int().min(1).max(MAX_LIMIT).optional().describe(`Results to return (default ${DEFAULT_LIMIT}).`),
  offset: z.number().int().min(0).max(5000).optional().describe('Results to skip, to read the following ones.'),
  language: languageInput,
}

export const searchOutput = z.object({
  query: z.string(),
  mode: z.enum(['text', 'meaning']),
  version: z.string(),
  total: z.number().describe('How many verses match in all.'),
  results: z.array(
    z.object({
      reference: z.string(),
      osis: z.string(),
      text: z.string(),
      topic: z.string().optional().describe('The theme a verse was found by, when not by its words.'),
      url: z.string().optional(),
    })
  ),
  nextOffset: z.number().optional().describe('Pass it as `offset` to read the following results.'),
})

type SearchModel = z.infer<typeof searchOutput>

/** The search marks what it found as `{{word}}`. */
const markedParts = (highlighted: string): MarkedPart[] => {
  const parts: MarkedPart[] = []
  const pattern = /\{\{(.*?)\}\}/gu
  let position = 0
  for (const match of highlighted.matchAll(pattern)) {
    if (match.index > position) parts.push({ text: highlighted.slice(position, match.index) })
    if (match[1]) parts.push({ text: match[1], hit: true })
    position = match.index + match[0].length
  }
  if (position < highlighted.length) parts.push({ text: highlighted.slice(position) })
  return parts
}

const bookNumber = (name: string, language: StudyLanguage): number => {
  const book = parsePassages(`${name} 1`, language)[0]?.book
  if (!book) throw new StudyError(`"${name}" is not the name of a book of the Bible.`)
  return book
}

export const loadSearch = async (
  context: StudyContext,
  input: {
    query: string
    mode?: 'text' | 'meaning'
    version?: string
    testament?: 'old' | 'new'
    book?: string
    limit?: number
    offset?: number
    language?: StudyLanguage
  }
): Promise<StudyResult<SearchModel>> => {
  const language = input.language ?? context.language
  const mode = input.mode ?? 'text'
  const version = resolveVersions(input.version ? [input.version] : undefined, language)[0]!
  const limit = input.limit ?? DEFAULT_LIMIT
  const offset = input.offset ?? 0
  const query = input.query.trim()

  const response = await context.api.get<BibleSearchResponseDto>(
    `/v1/bibles/${version.id}/${mode === 'meaning' ? 'semantic-search' : 'search'}`,
    {
      q: query,
      limit,
      offset,
      language,
      section: input.testament === 'old' ? 'ot' : input.testament === 'new' ? 'nt' : undefined,
      book: input.book ? bookNumber(input.book, language) : undefined,
    }
  )
  if (!response) throw new StudyError(`${version.id} cannot be searched online.`)

  const hits = response.results.map(result => {
    const passage: Passage = {
      book: result.book,
      chapter: result.chapter,
      startVerse: result.verse,
      // A hit can be a passage of several verses of one chapter.
      endVerse:
        result.endVerse && (result.endChapter ?? result.chapter) === result.chapter
          ? result.endVerse
          : result.verse,
      wholeChapter: false,
    }
    const topic = result.match?.kind === 'topic' ? result.match.topicLabel : undefined
    const hit: VerseHit = {
      label: formatPassage(passage, language),
      osis: passageOsis(passage),
      parts: markedParts(result.highlighted || result.text),
      ...(topic ? { note: topic } : {}),
    }
    return { hit, passage, text: quoteText(result.text), topic }
  })

  const nextOffset = offset + hits.length < response.count ? offset + hits.length : undefined
  const title = language === 'fr' ? `« ${query} »` : `“${query}”`
  const request = { ...input, query, mode, version: version.id, language, limit }

  const card: BibleSearchCard = {
    kind: 'bible_search',
    language,
    title,
    query,
    mode,
    version: version.id,
    versionName: versionName(version, language),
    total: response.count,
    items: hits.map(({ hit }) => hit),
    ...(nextOffset !== undefined ? { next: { ...request, offset: nextOffset } } : {}),
  }

  return {
    text: hits.length
      ? lines(
          `${response.count} verses match ${title} in ${version.id}` +
            (response.count > hits.length ? ` (showing ${offset + 1}–${offset + hits.length}).` : '.'),
          ...hits.map(
            ({ hit, text, topic }) => `${hit.label} — ${text}${topic ? ` [theme: ${topic}]` : ''}`
          )
        )
      : `No verse matches ${title} in ${version.id}.` +
        (mode === 'text' ? ' Try other words, or mode "meaning" to search by idea.' : ''),
    model: {
      query,
      mode,
      version: version.id,
      total: response.count,
      results: hits.map(({ hit, passage, text, topic }) => ({
        reference: hit.label,
        osis: hit.osis,
        text,
        ...(topic ? { topic } : {}),
        url: context.links.passage(version.id, passage),
      })),
      ...(nextOffset !== undefined ? { nextOffset } : {}),
    },
    card,
  }
}
