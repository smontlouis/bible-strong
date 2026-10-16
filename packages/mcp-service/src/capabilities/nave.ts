import { getSupportedOsisBookId } from '@bible-strong/bible-reference-parser/osis-reference'
import type {
  NaveTopicListResponseDto,
  NaveTopicResponseDto,
  NaveVerseTopicsResponseDto,
} from '@bible-strong/resource-domain/contracts/naveContract'
import * as z from 'zod/v4'
import { bookName } from '../bible/books'
import { formatVerse, verseKey } from '../bible/reference'
import type { Block, NaveTopicCard } from '../cards/types'
import type { StudyLanguage } from '../language'
import { blocksToText, htmlToBlocks, truncateText, type LinkResolver } from '../richText'
import {
  languageInput,
  lines,
  referenceInput,
  sourceLine,
  StudyError,
  type StudyContext,
  type StudyResult,
} from '../study'
import { requirePassages } from './passage'

const OUTLINE_LENGTH = 6000

// --- The outline of a topic --------------------------------------------------------
//
// A topic is an outline: entries holding lines of text and the lists of their sub-entries.
// It is published in two dialects of malformed HTML, which the public site reads the same
// way (apps/site/features/nave/naveHtml.ts): the English one nests `<ul>` lists whose
// `<li>` are rarely closed, the French one nests `<p>` inside `<p>`.

type OutlineBlock = string | OutlineEntry[]
type OutlineEntry = { blocks: OutlineBlock[] }
type Frame =
  | { kind: 'root' | 'p' | 'li'; entry: OutlineEntry }
  | { kind: 'ul'; list: OutlineEntry[] }

type VerseTarget = { book: number; chapter: number; verses: number[] }

const LINK_END_PATTERN = /<\/a\s*>/iu
const HREF_PATTERN = /\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/iu
const LIST_TAGS = new Set(['ul', 'ol'])
const INLINE_TAGS = new Set(['a', 'b', 'strong', 'i', 'em', 'u', 'small', 'cite', 'sup', 'sub'])
const BLOCK_TAGS = new Set([
  ...LIST_TAGS,
  ...['li', 'p', 'br', 'hr', 'div', 'blockquote', 'table', 'tr', 'dl', 'dt', 'dd'],
  ...['h1', 'h2', 'h3', 'h4', 'h5', 'h6'],
])

/** `book-chapter` for a whole chapter, or `book-chapter-verse,verse,…`. */
const parseVerseTarget = (target: string): VerseTarget | undefined => {
  const match = /^(\d{1,2})-(\d{1,3})(?:-(\d{1,3}(?:,\d{1,3})*))?$/u.exec(target.trim())
  if (!match) return undefined
  const book = Number(match[1])
  const chapter = Number(match[2])
  const verses = match[3]?.split(',').map(Number) ?? []
  if (!getSupportedOsisBookId(book) || !chapter || verses.includes(0)) return undefined
  return { book, chapter, verses }
}

/** Groups cited verses into runs of consecutive numbers, keeping their order. */
const verseRuns = (verses: readonly number[]): { start: number; end: number }[] => {
  const runs: { start: number; end: number }[] = []
  for (const verse of verses) {
    const last = runs.at(-1)
    if (last && verse === last.end + 1) last.end = verse
    else runs.push({ start: verse, end: verse })
  }
  return runs
}

/**
 * A reference as links, one per run of consecutive verses. The first label carries the
 * book and the chapter, the following ones only their verses: « Exode 6:13,26-27 ».
 */
const referenceLinks = (
  { book, chapter, verses }: VerseTarget,
  language: StudyLanguage
): { label: string; osis: string }[] => {
  const head = `${bookName(book, language)} ${chapter}`
  const osisChapter = `${getSupportedOsisBookId(book)}.${chapter}`
  const runs = verseRuns(verses)
  if (!runs.length) return [{ label: head, osis: osisChapter }]
  return runs.map(({ start, end }, index) => {
    const label = start === end ? String(start) : `${start}-${end}`
    return {
      label: index === 0 ? `${head}:${label}` : label,
      osis:
        start === end
          ? `${osisChapter}.${start}`
          : `${osisChapter}.${start}-${osisChapter}.${end}`,
    }
  })
}

const parseOutline = (
  html: string,
  language: StudyLanguage
): { blocks: OutlineBlock[]; referenceCount: number } => {
  const root: OutlineEntry = { blocks: [] }
  const stack: Frame[] = [{ kind: 'root', entry: root }]
  let line = ''
  let referenceCount = 0

  // The entry text and lists are added to. What a list holds between two of its entries
  // continues the one before it.
  const currentEntry = (): OutlineEntry => {
    const frame = stack[stack.length - 1] as Frame
    if (frame.kind !== 'ul') return frame.entry
    const last = frame.list.at(-1)
    if (last) return last
    const entry: OutlineEntry = { blocks: [] }
    frame.list.push(entry)
    return entry
  }
  const endLine = () => {
    const text = line.replace(/\s+/gu, ' ').trim()
    line = ''
    if (text) currentEntry().blocks.push(text)
  }
  const openList = (): OutlineEntry[] => {
    const list: OutlineEntry[] = []
    currentEntry().blocks.push(list)
    stack.push({ kind: 'ul', list })
    return list
  }
  const openEntry = (kind: 'p' | 'li', list: OutlineEntry[]) => {
    const entry: OutlineEntry = { blocks: [] }
    list.push(entry)
    stack.push({ kind, entry })
  }
  const closeThrough = (kind: Frame['kind']) => {
    const openedAt = stack.findLastIndex(frame => frame.kind === kind)
    if (openedAt > 0) stack.length = openedAt
  }

  const pattern = /<(\/?)([a-zA-Z][a-zA-Z0-9]*)\b[^>]*>/gu
  let position = 0
  for (let match = pattern.exec(html); match; match = pattern.exec(html)) {
    line += html.slice(position, match.index)
    position = pattern.lastIndex
    const closing = match[1] === '/'
    const tag = match[2]?.toLowerCase() ?? ''

    if (tag === 'a' && !closing) {
      const source = HREF_PATTERN.exec(match[0])
      const href = source?.[1] ?? source?.[2] ?? source?.[3] ?? ''
      const reference = href.startsWith('v=') ? parseVerseTarget(href.slice(2)) : undefined
      const end = reference ? LINK_END_PATTERN.exec(html.slice(position)) : null
      if (reference && end) {
        // The label of a verse link is rebuilt from its target: both publications print the
        // French book names, and a list of verses becomes one link per passage.
        line += referenceLinks(reference, language)
          .map(link => `<a href="bible://${link.osis}">${link.label}</a>`)
          .join(',')
        position += end.index + end[0].length
        pattern.lastIndex = position
        referenceCount += 1
        continue
      }
    }
    if (INLINE_TAGS.has(tag)) line += match[0]
    if (!BLOCK_TAGS.has(tag)) continue

    endLine()
    if (LIST_TAGS.has(tag)) {
      if (closing) closeThrough('ul')
      else openList()
    } else if (tag === 'li') {
      const listAt = stack.findLastIndex(frame => frame.kind === 'ul')
      const list = stack[listAt]
      if (closing) {
        // Only the entry still open in the innermost list is closed.
        if (stack.findLastIndex(frame => frame.kind === 'li') > listAt) closeThrough('li')
      } else if (list?.kind === 'ul') {
        // An entry ends the previous one of its list.
        stack.length = listAt + 1
        openEntry('li', list.list)
      } else {
        // Outside any list it starts one.
        stack.length = 1
        openEntry('li', openList())
      }
    } else if (tag === 'p' && !stack.some(frame => frame.kind === 'ul')) {
      // Outside lists a paragraph is an entry, and one opened inside another is its
      // sub-entry. Within a list it only separates lines.
      if (closing) closeThrough('p')
      else {
        const blocks = currentEntry().blocks
        const siblings = blocks.at(-1)
        if (Array.isArray(siblings)) openEntry('p', siblings)
        else {
          const list: OutlineEntry[] = []
          blocks.push(list)
          openEntry('p', list)
        }
      }
    }
  }
  line += html.slice(position)
  endLine()

  return { blocks: tidyBlocks(root.blocks), referenceCount }
}

/** Drops empty entries, lifts the ones that only wrap lists and merges adjacent lists. */
const tidyBlocks = (blocks: OutlineBlock[]): OutlineBlock[] => {
  const tidy: OutlineBlock[] = []
  for (const block of blocks) {
    if (typeof block === 'string') {
      tidy.push(block)
      continue
    }
    const entries = block.flatMap(entry => {
      const inner = tidyBlocks(entry.blocks)
      const lists = inner.filter((part): part is OutlineEntry[] => Array.isArray(part))
      return lists.length === inner.length ? lists.flat() : [{ blocks: inner }]
    })
    if (!entries.length) continue
    const previous = tidy.at(-1)
    if (Array.isArray(previous)) previous.push(...entries)
    else tidy.push(entries)
  }
  return tidy
}

// The first line of an entry names a sub-topic when references or sub-entries follow it.
const isHeading = (blocks: OutlineBlock[], index: number): boolean => {
  const first = blocks[0]
  return index === 0 && blocks.length > 1 && typeof first === 'string' && !/<a\b/iu.test(first)
}

/** A topic links a passage, or another topic by the name it is published under. */
const outlineLinks: LinkResolver = href => {
  if (href.startsWith('bible://')) return { t: 'ref', osis: href.slice('bible://'.length) }
  if (href.startsWith('w=')) {
    const name = href.slice(2).trim()
    return name ? { t: 'topic', name } : undefined
  }
  return undefined
}

const outlineToBlocks = (blocks: OutlineBlock[], inEntry: boolean): Block[] =>
  blocks.flatMap((block, index): Block[] => {
    if (typeof block !== 'string') {
      return [{ t: 'list', items: block.map(entry => outlineToBlocks(entry.blocks, true)) }]
    }
    const inline = htmlToBlocks(block, outlineLinks).flatMap(item =>
      item.t === 'p' || item.t === 'h' || item.t === 'quote' ? item.c : []
    )
    if (!inline.length) return []
    return [{ t: inEntry && isHeading(blocks, index) ? 'h' : 'p', c: inline }]
  })

// --- A topic -----------------------------------------------------------------------

export const naveTopicInput = {
  topic: z
    .string()
    .min(1)
    .max(120)
    .describe(
      'The topic to read: its name as people say it ("Amour", "Faith") or the `topic` ' +
        'identity returned by search_bible_topics or list_verse_topics ("love").'
    ),
  language: languageInput,
}

export const naveTopicOutput = z.object({
  topic: z.string().describe('The identity of the topic, for other calls.'),
  name: z.string(),
  references: z.number().describe('How many Bible passages the topic cites.'),
  outline: z.string().describe('Its sub-topics and the passages filed under each, as plain text.'),
  url: z.string().optional(),
})

const normalize = (value: string) =>
  value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim()

const topicPath = (language: StudyLanguage, normalizedName: string) =>
  `/v1/naves/${language}/topics/${encodeURIComponent(normalizedName)}`

const searchTopics = (context: StudyContext, language: StudyLanguage, query: string, limit: number) =>
  context.api.get<NaveTopicListResponseDto>(`/v1/naves/${language}/topics`, { search: query, limit })

export const loadNaveTopic = async (
  context: StudyContext,
  input: { topic: string; language?: StudyLanguage }
): Promise<StudyResult<z.infer<typeof naveTopicOutput>>> => {
  const language = input.language ?? context.language
  const asked = input.topic.trim()

  // A topic is published under an English identity in both languages.
  let response = await context.api.get<NaveTopicResponseDto>(topicPath(language, asked.toLowerCase()))
  if (!response) {
    const found = await searchTopics(context, language, asked, 20)
    const wanted = normalize(asked)
    const match =
      found?.topics.find(topic => normalize(topic.name) === wanted) ?? found?.topics[0]
    if (match) {
      response = await context.api.get<NaveTopicResponseDto>(topicPath(language, match.normalizedName))
    }
  }
  if (!response) {
    throw new StudyError(
      `The topical Bible has no topic "${asked}". search_bible_topics finds the topics that exist.`
    )
  }

  const { topic } = response
  const { blocks, referenceCount } = parseOutline(topic.description, language)
  const outline = outlineToBlocks(blocks, false)
  const url = context.links.naveTopic(language, topic.normalizedName)

  const card: NaveTopicCard = {
    kind: 'nave_topic',
    language,
    title: topic.name,
    normalizedName: topic.normalizedName,
    outline,
    referenceCount,
    url,
  }

  const text = truncateText(blocksToText(outline), OUTLINE_LENGTH)
  return {
    text: lines(`${topic.name} — ${referenceCount} passages`, '', text, '', sourceLine(url)),
    model: {
      topic: topic.normalizedName,
      name: topic.name,
      references: referenceCount,
      outline: text,
      url,
    },
    card,
  }
}

// --- Finding topics ------------------------------------------------------------------

const topicSummary = z.object({
  topic: z.string().describe('The identity of the topic, for get_bible_topic.'),
  name: z.string(),
})

export const naveSearchInput = {
  query: z.string().min(1).max(80).describe('A word of the topic name: "pardon", "prayer".'),
  limit: z.number().int().min(1).max(50).optional().describe('Topics to return (default 20).'),
  language: languageInput,
}

export const naveSearchOutput = z.object({ query: z.string(), topics: z.array(topicSummary) })

export const loadNaveSearch = async (
  context: StudyContext,
  input: { query: string; limit?: number; language?: StudyLanguage }
): Promise<StudyResult<z.infer<typeof naveSearchOutput>>> => {
  const language = input.language ?? context.language
  const query = input.query.trim()
  const found = await searchTopics(context, language, query, input.limit ?? 20)
  const topics = (found?.topics ?? []).map(topic => ({
    topic: topic.normalizedName,
    name: topic.name,
  }))
  return {
    text: topics.length
      ? topics.map(topic => `${topic.name} [${topic.topic}]`).join('\n')
      : `No topic is named like "${query}".`,
    model: { query, topics },
  }
}

export const verseTopicsInput = {
  reference: referenceInput('The verse whose topics to list'),
  language: languageInput,
}

export const verseTopicsOutput = z.object({
  reference: z.string(),
  topics: z.array(topicSummary).describe('Topics citing this verse.'),
  chapterTopics: z.array(topicSummary).describe('Topics citing its whole chapter.'),
})

export const loadVerseTopics = async (
  context: StudyContext,
  input: { reference: string; language?: StudyLanguage }
): Promise<StudyResult<z.infer<typeof verseTopicsOutput>>> => {
  const language = input.language ?? context.language
  const passage = requirePassages(input.reference, language)[0]!
  const verse = { book: passage.book, chapter: passage.chapter, verse: passage.startVerse }
  const response = await context.api.get<NaveVerseTopicsResponseDto>(
    `/v1/naves/${language}/verses/${verseKey(verse)}/topics`
  )
  const summarize = (items: readonly { normalizedName: string; name: string }[] = []) =>
    items.map(item => ({ topic: item.normalizedName, name: item.name }))
  const topics = summarize(response?.verseTopics)
  const chapterTopics = summarize(response?.chapterTopics)
  const reference = formatVerse(verse, language)
  return {
    text: lines(
      topics.length
        ? `${reference} is cited by: ${topics.map(topic => `${topic.name} [${topic.topic}]`).join(', ')}`
        : `No topic cites ${reference}.`,
      chapterTopics.length
        ? `Its chapter is cited by: ${chapterTopics.map(topic => `${topic.name} [${topic.topic}]`).join(', ')}`
        : undefined
    ),
    model: { reference, topics, chapterTopics },
  }
}
