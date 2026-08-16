import { createHash } from 'node:crypto'

import type { CanonicalBiblePublication, CanonicalBibleVerse } from './publicationBundle'

type LegacyBible = Record<string, Record<string, Record<string, string>>>
type LegacyPericope = Record<
  string,
  Record<string, Record<string, Partial<Record<'h1' | 'h2' | 'h3' | 'h4', string>>>>
>
type LegacyRedWords = Record<string, { start: number; end: number }[]>

const HEADING_TYPES = {
  h1: 'majorSection',
  h2: 'scope',
  h3: 'section',
  h4: 'subsection',
} as const

const escapeMarkup = (value: string) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')

const toRedWordLayout = (text: string, ranges: readonly { start: number; end: number }[]) => {
  const words = [...text.matchAll(/\S+/gu)].map(
    match => [match.index, match.index + match[0].length] as const
  )
  const characterRanges = ranges
    .filter(range => range.start >= 0 && range.end >= range.start && range.start < words.length)
    .map(
      range =>
        [words[range.start]![0], words[Math.min(range.end, words.length - 1)]![1]] as [
          number,
          number,
        ]
    )
    .sort((left, right) => left[0] - right[0])
  const merged: [number, number][] = []
  for (const range of characterRanges) {
    const previous = merged.at(-1)
    if (previous && range[0] <= previous[1]) previous[1] = Math.max(previous[1], range[1])
    else merged.push(range)
  }
  return merged.flatMap(([start, end], index) => [
    { offset: start, order: index * 2, type: 'open' as const, tag: 'wj' },
    { offset: end, order: index * 2 + 1, type: 'close' as const, tag: 'wj' },
  ])
}

export const hashCanonicalVerses = (verses: CanonicalBiblePublication['verses']) => {
  const hash = createHash('sha256')
  for (const book of Object.keys(verses).sort((left, right) => Number(left) - Number(right))) {
    for (const chapter of Object.keys(verses[book]!).sort(
      (left, right) => Number(left) - Number(right)
    )) {
      for (const verse of Object.keys(verses[book]![chapter]!).sort(
        (left, right) => Number(left) - Number(right)
      )) {
        hash.update(
          `${JSON.stringify([Number(book), Number(chapter), Number(verse), verses[book]![chapter]![verse]])}\n`
        )
      }
    }
  }
  return hash.digest('hex')
}

export const buildCanonicalBibleFromLegacy = (options: {
  versionId: string
  sourceVersion: string
  sourceSha256: string
  bible: unknown
  pericope?: unknown
  redWords?: unknown
}): CanonicalBiblePublication => {
  const bible = options.bible as LegacyBible
  const pericope = (options.pericope ?? {}) as LegacyPericope
  const redWords = (options.redWords ?? {}) as LegacyRedWords
  const verses: CanonicalBiblePublication['verses'] = {}
  let verseCount = 0
  let headingCount = 0

  for (const [book, chapters] of Object.entries(bible)) {
    if (!/^[1-9]\d*$/.test(book)) continue
    const outputChapters: Record<string, Record<string, CanonicalBibleVerse>> = {}
    for (const [chapter, chapterVerses] of Object.entries(chapters)) {
      if (!/^[1-9]\d*$/.test(chapter)) continue
      const outputVerses: Record<string, CanonicalBibleVerse> = {}
      for (const [verse, text] of Object.entries(chapterVerses)) {
        if (!/^\d+$/.test(verse)) continue
        if (typeof text !== 'string') throw new Error('LEGACY_BIBLE_VERSE_INVALID')
        const headings = Object.entries(pericope[book]?.[chapter]?.[verse] ?? {})
          .filter(
            (entry): entry is [keyof typeof HEADING_TYPES, string] =>
              entry[0] in HEADING_TYPES && typeof entry[1] === 'string' && entry[1].length > 0
          )
          .map(([level, headingText], order) => ({
            offset: 0,
            order,
            kind: 'pericope' as const,
            type: HEADING_TYPES[level],
            text: headingText,
            markup: `<${level}>${escapeMarkup(headingText)}</${level}>`,
          }))
        headingCount += headings.length
        outputVerses[verse] = {
          text,
          startTags: [],
          layout: toRedWordLayout(text, redWords[`${book}-${chapter}-${verse}`] ?? []),
          notes: [],
          headings,
        }
        verseCount += 1
      }
      if (Object.keys(outputVerses).length > 0) outputChapters[chapter] = outputVerses
    }
    if (Object.keys(outputChapters).length > 0) verses[book] = outputChapters
  }

  const textSha256 = hashCanonicalVerses(verses)
  return {
    format: 'bible-strong-canonical-bible',
    schemaVersion: 4,
    applicationVersionId: options.versionId,
    textRevision: `${options.versionId.toLowerCase()}-${textSha256.slice(0, 20)}`,
    textSha256,
    sourceVersion: options.sourceVersion,
    sourceSha256: options.sourceSha256,
    verseCount,
    noteCount: 0,
    headingCount,
    verses,
  }
}
