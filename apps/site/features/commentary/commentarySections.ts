import { editorialHtmlToText } from '../resources/editorialHtml'

/**
 * One commentary on a run of verses. The slug is the suffix of the deterministic section ID
 * of the study workspace (ADR-0054), so a section has the same address on both.
 */
export type CommentarySection = {
  slug: string
  /** Verse 0 stands for the introduction of the chapter. */
  startVerse: number
  endVerse: number
  content: string
}

/** The comments of a chapter as published: HTML by verse number. */
export type SerializedCommentaryChapter = Record<string, string>

// A verse-indexed anthology whose excerpts are regrouped by the document they come from.
const EGW_WRITINGS_RESOURCE_ID = 'egw-writings'
const EGW_BOOK_HEADING_PATTERN = /<h3\b[^>]*>[\s\S]*?<\/h3>/iu
const EGW_SECTION_HEADING_PATTERN = /<h4\b[^>]*>[\s\S]*?<\/h4>/iu
const EGW_CONTEXT_LINK_PATTERN =
  /<p>\s*(?:<br\s*\/?>\s*)?<a\b[^>]*\bclass=(?:"[^"]*\bexternal-source\b[^"]*"|'[^']*\bexternal-source\b[^']*')[^>]*>[\s\S]*?<\/a>\s*<\/p>/iu
const EGW_CONTEXT_HREF_PATTERN =
  /<a\b[^>]*\bclass=(?:"[^"]*\bexternal-source\b[^"]*"|'[^']*\bexternal-source\b[^']*')[^>]*\bhref=(?:"([^"]+)"|'([^']+)')[^>]*>/iu

/** Reads the `serializedComments` of a chapter response; anything malformed is left out. */
export const decodeCommentaryChapter = (serialized: string): SerializedCommentaryChapter => {
  let decoded: unknown
  try {
    decoded = JSON.parse(serialized)
  } catch {
    return {}
  }
  if (!decoded || typeof decoded !== 'object' || Array.isArray(decoded)) return {}
  return Object.fromEntries(
    Object.entries(decoded).filter(
      (entry): entry is [string, string] => /^\d+$/u.test(entry[0]) && typeof entry[1] === 'string'
    )
  )
}

// A verse may carry several comments, separated by a rule.
const splitFragments = (content: string): string[] =>
  content
    .split(/<hr\b[^>]*\/?\s*>/giu)
    .map(fragment => fragment.trim())
    .filter(Boolean)

/** A comment repeated on consecutive verses is one comment on that run of verses. */
const sectionRuns = (comments: SerializedCommentaryChapter) => {
  const occurrencesByContent = new Map<string, { verse: number; fragmentIndex: number }[]>()
  for (const [verseKey, content] of Object.entries(comments).sort(
    ([left], [right]) => Number(left) - Number(right)
  )) {
    const verse = Number(verseKey)
    splitFragments(content).forEach((fragment, fragmentIndex) => {
      const occurrences = occurrencesByContent.get(fragment) ?? []
      if (!occurrences.some(candidate => candidate.verse === verse)) {
        occurrences.push({ verse, fragmentIndex })
      }
      occurrencesByContent.set(fragment, occurrences)
    })
  }

  const runs: { start: number; end: number; fragmentIndex: number; content: string }[] = []
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

type EgwFragment = {
  groupKey: string
  sourcePosition: readonly number[]
  bookHeading: string
  sectionHeading: string
  body: string
  contextLink: string
}

const parseEgwFragment = (content: string): EgwFragment | undefined => {
  const bookHeading = EGW_BOOK_HEADING_PATTERN.exec(content)?.[0]
  const sectionHeading = EGW_SECTION_HEADING_PATTERN.exec(content)?.[0]
  const contextLink = EGW_CONTEXT_LINK_PATTERN.exec(content)?.[0]
  if (!bookHeading || !sectionHeading || !contextLink) return undefined

  const hrefMatch = EGW_CONTEXT_HREF_PATTERN.exec(contextLink)
  const source = /\/read\/(\d+)(?:\.(\d+))?/u.exec(hrefMatch?.[1] ?? hrefMatch?.[2] ?? '')
  const bookTitle = editorialHtmlToText(bookHeading)
  return {
    groupKey: `${source?.[1] ?? bookTitle}\u0000${bookTitle}\u0000${editorialHtmlToText(sectionHeading)}`,
    sourcePosition: source
      ? [Number(source[1]), Number(source[2] ?? 0)]
      : [Number.MAX_SAFE_INTEGER],
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

const compareSourcePositions = (left: readonly number[], right: readonly number[]): number => {
  for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
    const difference = (left[index] ?? 0) - (right[index] ?? 0)
    if (difference !== 0) return difference
  }
  return 0
}

/** Excerpts of one source document become one section, in the order of the document. */
const mergeEgwSections = (sections: CommentarySection[]): CommentarySection[] => {
  const groups = new Map<string, { sections: CommentarySection[]; fragments: EgwFragment[] }>()
  const ungrouped: CommentarySection[] = []
  for (const section of sections) {
    const fragment = parseEgwFragment(section.content)
    if (!fragment) {
      ungrouped.push(section)
      continue
    }
    const group = groups.get(fragment.groupKey) ?? { sections: [], fragments: [] }
    group.sections.push(section)
    group.fragments.push(fragment)
    groups.set(fragment.groupKey, group)
  }

  const merged = [...groups.values()].map(({ sections: members, fragments }) => {
    const first = fragments[0]
    // An excerpt quoted on verses that do not follow each other is read once.
    const bodies = new Set(
      [...fragments]
        .sort((left, right) => compareSourcePositions(left.sourcePosition, right.sourcePosition))
        .map(fragment => fragment.body)
    )
    return {
      slug: members[0].slug,
      startVerse: Math.min(...members.map(member => member.startVerse)),
      endVerse: Math.max(...members.map(member => member.endVerse)),
      content: `${first.bookHeading}${first.sectionHeading}${[...bodies].join('<br /><br />')}${first.contextLink}`,
    }
  })
  return [...merged, ...ungrouped].sort(
    (left, right) =>
      left.startVerse - right.startVerse ||
      left.endVerse - right.endVerse ||
      left.slug.localeCompare(right.slug)
  )
}

/**
 * The sections of a chapter, in reading order.
 *
 * This is the projection the study workspace applies to the same chapter response
 * (`buildCommentaryResourceSections` of the Resource domain), written again here because
 * that module depends on runtime libraries the site does not load. Slugs and verse ranges
 * must stay identical on both sides: they are the section segment of the shared route
 * grammar.
 */
export const buildCommentarySections = (
  resourceId: string,
  comments: SerializedCommentaryChapter
): CommentarySection[] => {
  const occurrencesByRange = new Map<string, number>()
  const sections = sectionRuns(comments).map(({ start, end, content }) => {
    const range = `${start}-${end}`
    const occurrence = occurrencesByRange.get(range) ?? 0
    occurrencesByRange.set(range, occurrence + 1)
    return {
      slug: occurrence === 0 ? range : `${range}-${occurrence + 1}`,
      startVerse: start,
      endVerse: end,
      content,
    }
  })
  return resourceId === EGW_WRITINGS_RESOURCE_ID ? mergeEgwSections(sections) : sections
}

/**
 * How much source HTML one page carries. Nearly every chapter fits; a verse-indexed
 * anthology quoting hundreds of excerpts on a chapter, or an exposition the length of a
 * book, continues on further pages.
 */
export const COMMENTARY_PAGE_BUDGET = 200_000

/**
 * Cuts a section longer than a page into parts that fit, each starting on one of its
 * headings: the only place where its markup is known to be closed. A section without
 * headings stays whole.
 */
const splitLongSection = <Section extends { content: string }>(
  section: Section,
  budget: number
): Section[] => {
  const { content } = section
  if (content.length <= budget) return [section]
  const headings = [...content.matchAll(/<h[1-6]\b/giu)].map(match => match.index)
  const parts: string[] = []
  let start = 0
  let previous = 0
  for (const cut of [...headings, content.length]) {
    if (cut - start > budget && previous > start) {
      parts.push(content.slice(start, previous))
      start = previous
    }
    previous = cut
  }
  parts.push(content.slice(start))
  return parts.map(part => ({ ...section, content: part }))
}

/**
 * Cuts sections into pages; a page holds at least one section. The parts of a long
 * section never share a page, so a section is met once per page at most.
 */
export const paginateCommentarySections = <Section extends { content: string }>(
  sections: readonly Section[],
  budget = COMMENTARY_PAGE_BUDGET
): Section[][] => {
  const pages: Section[][] = []
  let size = 0
  for (const section of sections.flatMap(whole => splitLongSection(whole, budget))) {
    const current = pages[pages.length - 1]
    if (!current || size + section.content.length > budget) {
      pages.push([section])
      size = section.content.length
      continue
    }
    current.push(section)
    size += section.content.length
  }
  return pages
}

/** Sections commenting the same verses, read under one heading. */
export const groupCommentarySectionsByRange = <
  Section extends { startVerse: number; endVerse: number },
>(
  sections: readonly Section[]
): { startVerse: number; endVerse: number; sections: Section[] }[] => {
  const groups: { startVerse: number; endVerse: number; sections: Section[] }[] = []
  for (const section of sections) {
    const last = groups[groups.length - 1]
    if (last && last.startVerse === section.startVerse && last.endVerse === section.endVerse) {
      last.sections.push(section)
    } else {
      groups.push({ startVerse: section.startVerse, endVerse: section.endVerse, sections: [section] })
    }
  }
  return groups
}

/**
 * The verses a section comments, as written after a chapter number: `16` or `1-21`. The
 * introduction of a chapter, filed under verse 0, has none.
 */
export const commentaryVerseRange = ({
  startVerse,
  endVerse,
}: {
  startVerse: number
  endVerse: number
}): string | undefined => {
  if (endVerse < 1) return undefined
  const first = Math.max(startVerse, 1)
  return first === endVerse ? String(first) : `${first}-${endVerse}`
}
