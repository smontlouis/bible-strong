/**
 * The sections of a commentary on one chapter, as the public site addresses them, and the
 * rule that picks the one bearing on a verse. This module loads nothing: the public site
 * and the Resource service both apply it to the comments of a chapter, keyed by verse.
 *
 * The study workspace builds its sections with `buildCommentaryResourceSections`, which
 * also writes previews with an HTML parser. Slugs and verse ranges are the same on both
 * sides: a slug is the suffix of the deterministic section identifier (ADR-0054).
 */

/** One commentary on a run of verses. */
export type CommentaryChapterSection = {
  slug: string
  /** Verse 0 stands for the introduction of the chapter. */
  startVerse: number
  endVerse: number
  content: string
}

/** The comments of a chapter as published: HTML by verse number. */
export type CommentaryChapterComments = Record<string, string>

// A verse-indexed anthology whose excerpts are regrouped by the document they come from.
const EGW_WRITINGS_RESOURCE_ID = 'egw-writings'
const EGW_BOOK_HEADING_PATTERN = /<h3\b[^>]*>[\s\S]*?<\/h3>/iu
const EGW_SECTION_HEADING_PATTERN = /<h4\b[^>]*>[\s\S]*?<\/h4>/iu
const EGW_CONTEXT_LINK_PATTERN =
  /<p>\s*(?:<br\s*\/?>\s*)?<a\b[^>]*\bclass=(?:"[^"]*\bexternal-source\b[^"]*"|'[^']*\bexternal-source\b[^']*')[^>]*>[\s\S]*?<\/a>\s*<\/p>/iu
const EGW_CONTEXT_HREF_PATTERN =
  /<a\b[^>]*\bclass=(?:"[^"]*\bexternal-source\b[^"]*"|'[^']*\bexternal-source\b[^']*')[^>]*\bhref=(?:"([^"]+)"|'([^']+)')[^>]*>/iu

const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
}

// The text of a heading: tags removed, common entities decoded, white space collapsed.
const headingText = (html: string): string =>
  html
    .replace(/<br\s*\/?>|<\/(?:p|div|li|dd|dt|td|th|tr|blockquote|h[1-6])>/giu, ' ')
    .replace(/<[^>]*>/gu, '')
    .replace(/&(#\d+|#x[0-9a-f]+|[a-z]+);/giu, (entity, name: string) => {
      const key = name.toLowerCase()
      if (key.startsWith('#x')) return String.fromCodePoint(Number.parseInt(key.slice(2), 16))
      if (key.startsWith('#')) return String.fromCodePoint(Number(key.slice(1)))
      return ENTITIES[key] ?? entity
    })
    .replace(/\s+/gu, ' ')
    .trim()

// A verse may carry several comments, separated by a rule.
const splitFragments = (content: string): string[] =>
  content
    .split(/<hr\b[^>]*\/?\s*>/giu)
    .map(fragment => fragment.trim())
    .filter(Boolean)

/** A comment repeated on consecutive verses is one comment on that run of verses. */
const sectionRuns = (comments: CommentaryChapterComments) => {
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
      const first = occurrences[index]!
      let endIndex = index
      while (
        endIndex + 1 < occurrences.length &&
        occurrences[endIndex + 1]!.verse === occurrences[endIndex]!.verse + 1
      ) {
        endIndex += 1
      }
      runs.push({
        start: first.verse,
        end: occurrences[endIndex]!.verse,
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
  const bookTitle = headingText(bookHeading)
  return {
    groupKey: `${source?.[1] ?? bookTitle}\u0000${bookTitle}\u0000${headingText(sectionHeading)}`,
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
const mergeEgwSections = (sections: CommentaryChapterSection[]): CommentaryChapterSection[] => {
  const groups = new Map<
    string,
    { sections: CommentaryChapterSection[]; fragments: EgwFragment[] }
  >()
  const ungrouped: CommentaryChapterSection[] = []
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
    const first = fragments[0]!
    // An excerpt quoted on verses that do not follow each other is read once.
    const bodies = new Set(
      [...fragments]
        .sort((left, right) => compareSourcePositions(left.sourcePosition, right.sourcePosition))
        .map(fragment => fragment.body)
    )
    return {
      slug: members[0]!.slug,
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
 * The sections of a chapter, in reading order. `resourceId` is the catalog identity of the
 * commentary: one of them is an anthology whose excerpts are read by source document.
 */
export const buildCommentaryChapterSections = (
  resourceId: string,
  comments: CommentaryChapterComments
): CommentaryChapterSection[] => {
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
 * The comment of a commentary that bears most closely on a verse: among the sections that
 * cover it, the one on the fewest verses. The introduction of the chapter covers none.
 */
export const closestCommentarySection = <Section extends { startVerse: number; endVerse: number }>(
  sections: readonly Section[],
  verse: number
): Section | undefined =>
  sections
    .filter(
      section => section.endVerse > 0 && section.startVerse <= verse && verse <= section.endVerse
    )
    .sort(
      (left, right) =>
        left.endVerse - left.startVerse - (right.endVerse - right.startVerse) ||
        right.startVerse - left.startVerse
    )[0]
