import { COMMENTARY_READING_EXCERPT_LENGTH } from '@bible-strong/resource-domain/contracts/commentaryReadingContract'
import { DomUtils, parseDocument } from 'htmlparser2'

type ResourceLanguage = 'fr' | 'en'
type SerializedCommentaryChapter = Record<string, string | readonly string[]>
type CommentaryCatalogEntry = { id: string; publicationId: string }

export type CommentaryResourceSection = {
  id: string
  rangeStartVerse: number
  rangeEndVerse: number
  preview: string
  content: string
}

const COMMENTARY_PREVIEW_MAX_CHARACTERS = 1_200
const EGW_WRITINGS_RESOURCE_ID = 'egw-writings'
const EGW_BOOK_HEADING_PATTERN = /<h3\b[^>]*>[\s\S]*?<\/h3>/iu
const EGW_SECTION_HEADING_PATTERN = /<h4\b[^>]*>[\s\S]*?<\/h4>/iu
const EGW_CONTEXT_LINK_PATTERN =
  /<p>\s*(?:<br\s*\/?>\s*)?<a\b[^>]*\bclass=(?:"[^"]*\bexternal-source\b[^"]*"|'[^']*\bexternal-source\b[^']*')[^>]*>[\s\S]*?<\/a>\s*<\/p>/iu
const EGW_CONTEXT_HREF_PATTERN =
  /<a\b[^>]*\bclass=(?:"[^"]*\bexternal-source\b[^"]*"|'[^']*\bexternal-source\b[^']*')[^>]*\bhref=(?:"([^"]+)"|'([^']+)')[^>]*>/iu
const COMMENTARY_BLOCK_TAG_PATTERN = /<\/?(?:blockquote|br|div|h[1-6]|hr|li|ol|p|ul)\b[^>]*>/giu

export const createCommentaryPreview = (html: string) =>
  DomUtils.textContent(parseDocument(html.replace(COMMENTARY_BLOCK_TAG_PATTERN, ' ')))
    .replace(/\s+/gu, ' ')
    .trim()
    .slice(0, COMMENTARY_PREVIEW_MAX_CHARACTERS)
    .trimEnd()

const getHtmlText = (html: string) => DomUtils.textContent(parseDocument(html)).trim()

type EgwDocumentFragment = {
  groupKey: string
  sourcePosition: readonly number[]
  bookHeading: string
  sectionHeading: string
  body: string
  contextLink: string
}

const parseEgwDocumentFragment = (content: string): EgwDocumentFragment | undefined => {
  const bookHeading = content.match(EGW_BOOK_HEADING_PATTERN)?.[0]
  const sectionHeading = content.match(EGW_SECTION_HEADING_PATTERN)?.[0]
  const contextLink = content.match(EGW_CONTEXT_LINK_PATTERN)?.[0]
  if (!bookHeading || !sectionHeading || !contextLink) return undefined

  const hrefMatch = contextLink.match(EGW_CONTEXT_HREF_PATTERN)
  const href = hrefMatch?.[1] ?? hrefMatch?.[2] ?? ''
  const sourceMatch = /\/read\/(\d+)(?:\.(\d+))?/u.exec(href)
  const sourcePosition = sourceMatch
    ? [Number(sourceMatch[1]), Number(sourceMatch[2] ?? 0)]
    : [Number.MAX_SAFE_INTEGER]
  const bookTitle = getHtmlText(bookHeading)
  const sectionTitle = getHtmlText(sectionHeading)
  const sourceBookId = sourceMatch?.[1] ?? bookTitle

  return {
    groupKey: `${sourceBookId}\u0000${bookTitle}\u0000${sectionTitle}`,
    sourcePosition,
    bookHeading,
    sectionHeading,
    body: content
      .replace(EGW_BOOK_HEADING_PATTERN, '')
      .replace(EGW_SECTION_HEADING_PATTERN, '')
      .replace(EGW_CONTEXT_LINK_PATTERN, '')
      .trim(),
    contextLink,
  }
}

const compareSourcePositions = (left: readonly number[], right: readonly number[]) => {
  const length = Math.max(left.length, right.length)
  for (let index = 0; index < length; index += 1) {
    const difference = (left[index] ?? 0) - (right[index] ?? 0)
    if (difference !== 0) return difference
  }
  return 0
}

export const createCommentarySectionId = (
  publicationId: string,
  language: ResourceLanguage,
  book: number,
  chapter: number,
  start: number,
  end: number
) => `${publicationId}-${language}-${book}-${chapter}-${start}-${end}`

const splitCommentarySections = (content: string) =>
  content
    .split(/<hr\b[^>]*\/?\s*>/giu)
    .map(section => section.trim())
    .filter(Boolean)

const getCommentarySectionRuns = (comments: SerializedCommentaryChapter) => {
  const occurrencesByContent = new Map<string, { verse: number; fragmentIndex: number }[]>()

  for (const [verseKey, content] of Object.entries(comments).sort(
    ([left], [right]) => Number(left) - Number(right)
  )) {
    const verse = Number(verseKey)
    const fragments = typeof content === 'string' ? splitCommentarySections(content) : content
    fragments.forEach((fragment, fragmentIndex) => {
      const occurrences = occurrencesByContent.get(fragment) ?? []
      if (!occurrences.some(candidate => candidate.verse === verse)) {
        occurrences.push({ verse, fragmentIndex })
      }
      occurrencesByContent.set(fragment, occurrences)
    })
  }

  const runs: {
    start: number
    end: number
    fragmentIndex: number
    content: string
  }[] = []
  for (const [content, occurrences] of occurrencesByContent) {
    for (let index = 0; index < occurrences.length; ) {
      const first = occurrences[index]
      let endIndex = index
      while (
        endIndex + 1 < occurrences.length &&
        occurrences[endIndex + 1].verse === occurrences[endIndex].verse + 1
      ) {
        endIndex += 1
      }
      runs.push({
        start: first.verse,
        end: occurrences[endIndex].verse,
        fragmentIndex: first.fragmentIndex,
        content,
      })
      index = endIndex + 1
    }
  }

  return runs.sort(
    (left, right) =>
      left.start - right.start || left.fragmentIndex - right.fragmentIndex || left.end - right.end
  )
}

export const buildCommentaryResourceSections = ({
  entry,
  language,
  book,
  chapter,
  comments,
  preserveVerseGaps = false,
}: {
  entry: CommentaryCatalogEntry
  language: ResourceLanguage
  book: number
  chapter: number
  comments: SerializedCommentaryChapter
  preserveVerseGaps?: boolean
}) => {
  const sections: CommentaryResourceSection[] = []
  const sectionIdOccurrences = new Map<string, number>()
  for (const { start, end, content } of getCommentarySectionRuns(comments)) {
    const baseId = createCommentarySectionId(
      entry.publicationId,
      language,
      book,
      chapter,
      start,
      end
    )
    const idOccurrence = sectionIdOccurrences.get(baseId) ?? 0
    sectionIdOccurrences.set(baseId, idOccurrence + 1)
    sections.push({
      id: idOccurrence === 0 ? baseId : `${baseId}-${idOccurrence + 1}`,
      rangeStartVerse: start,
      rangeEndVerse: end,
      preview: createCommentaryPreview(content),
      content,
    })
  }
  if (entry.id !== EGW_WRITINGS_RESOURCE_ID) return sections

  const groupedSections = new Map<
    string,
    {
      sections: CommentaryResourceSection[]
      fragments: EgwDocumentFragment[]
    }
  >()
  const ungroupedSections: CommentaryResourceSection[] = []
  for (const section of sections) {
    const fragment = parseEgwDocumentFragment(section.content)
    if (!fragment) {
      ungroupedSections.push(section)
      continue
    }
    const group = groupedSections.get(fragment.groupKey) ?? { sections: [], fragments: [] }
    group.sections.push(section)
    group.fragments.push(fragment)
    groupedSections.set(fragment.groupKey, group)
  }

  // Reading chips must not imply an association on verses absent from the source.
  // Detail screens keep their historical document grouping; reading splits gaps.
  const groups = [...groupedSections.values()].flatMap(group => {
    if (!preserveVerseGaps) return [group]
    const runs: (typeof group)[] = []
    const ordered = group.sections
      .map((section, index) => ({ section, fragment: group.fragments[index] }))
      .sort((a, b) => a.section.rangeStartVerse - b.section.rangeStartVerse)
    let end = -1
    for (const { section, fragment } of ordered) {
      if (
        !runs.length ||
        section.rangeStartVerse > end + 1 ||
        (end === 0 && section.rangeStartVerse > 0)
      ) {
        runs.push({ sections: [], fragments: [] })
        end = section.rangeEndVerse
      }
      const run = runs[runs.length - 1]
      run.sections.push(section)
      run.fragments.push(fragment)
      end = Math.max(end, section.rangeEndVerse)
    }
    return runs
  })
  const mergedSections = groups.map(({ sections: members, fragments }) => {
    const firstMember = members[0]
    const firstFragment = fragments[0]
    const orderedFragments = [...fragments].sort((left, right) =>
      compareSourcePositions(left.sourcePosition, right.sourcePosition)
    )
    const content = `${firstFragment.bookHeading}${firstFragment.sectionHeading}${orderedFragments
      .map(fragment => fragment.body)
      .join('<br /><br />')}${firstFragment.contextLink}`
    return {
      id: firstMember.id,
      rangeStartVerse: Math.min(...members.map(member => member.rangeStartVerse)),
      rangeEndVerse: Math.max(...members.map(member => member.rangeEndVerse)),
      preview: createCommentaryPreview(content),
      content,
    }
  })

  return [...mergedSections, ...ungroupedSections].sort(
    (left, right) =>
      left.rangeStartVerse - right.rangeStartVerse ||
      left.rangeEndVerse - right.rangeEndVerse ||
      left.id.localeCompare(right.id)
  )
}

/** Exact, contiguous associations for inline reading, including EGW source gaps. */
export const buildCommentaryReadingSections = (
  input: Omit<Parameters<typeof buildCommentaryResourceSections>[0], 'preserveVerseGaps'>
) => buildCommentaryResourceSections({ ...input, preserveVerseGaps: true })

/** Reuse document strings across verse associations instead of expanding a chapter's HTML. */
export function buildNormalizedCommentaryReadingSections({
  documents,
  associations,
  ...input
}: Omit<Parameters<typeof buildCommentaryReadingSections>[0], 'comments'> & {
  documents: readonly { id: string; content: string }[]
  associations: readonly { verse: number; documentId: string; ordinal: number }[]
}) {
  const fragments = new Map(
    documents.map(document => [document.id, splitCommentarySections(document.content)])
  )
  const comments: Record<string, string[]> = {}
  for (const association of [...associations].sort(
    (a, b) => a.verse - b.verse || a.ordinal - b.ordinal
  )) {
    const parts = fragments.get(association.documentId)
    if (!parts) throw new Error('COMMENTARY_DOCUMENT_MISSING')
    ;(comments[association.verse] ??= []).push(...parts)
  }
  return buildCommentaryReadingSections({ ...input, comments })
}

/** Publication-time projection: no HTML or full section content crosses the index boundary. */
export function createCommentaryReadingIndex(sections: readonly CommentaryResourceSection[]) {
  return sections.map(section => ({
    id: section.id,
    rangeStartVerse: section.rangeStartVerse,
    rangeEndVerse: section.rangeEndVerse,
    excerpt: createCommentaryPreview(section.content)
      .slice(0, COMMENTARY_READING_EXCERPT_LENGTH)
      .trimEnd(),
  }))
}
