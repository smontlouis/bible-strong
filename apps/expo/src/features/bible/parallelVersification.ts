/**
 * Parallel reading and version comparison across numberings (docs/research/versification-adr-draft.md,
 * « Clients convert before they read »): a column numbered differently from the main version
 * shows the verses that correspond to the main version's chapter, in its own numbering, and
 * its rows follow the versification table rather than the verse number.
 */
import {
  bibleVersification,
  compareVerseRefs,
  convertVerse,
  convertVerseKey,
  formatVerseKey,
  isPsalmTitleVerse,
  lastVerseOfChapter,
  parseVerseKey,
  toPivot,
  versesOfRange,
  versificationHasVerse,
  type VerseRef,
  type VersificationId,
} from '@bible-strong/resource-domain/versification'
import type { Verse } from '~common/types'
import type { HighlightsObj, WordAnnotationsObj } from '~redux/modules/user'
import type { ParallelColumnAlignment, ParallelVerse } from './BibleDOM/BibleDOMWrapper'

interface ColumnNumbering {
  main: VersificationId
  column: VersificationId
}

/**
 * The numberings a column is aligned through, or undefined when either is unknown or both are
 * the same: the column is then aligned by verse number, as before conversion.
 */
export const getParallelColumnNumbering = (
  mainVersion: string,
  columnVersion: string
): ColumnNumbering | undefined => {
  const main = bibleVersification(mainVersion)
  const column = bibleVersification(columnVersion)
  return main && column && main !== column ? { main, column } : undefined
}

interface ParallelColumnChapterRequest {
  book: number
  chapter: number
  mainVersion: string
  columnVersion: string
}

/**
 * The chapters of the column that hold the verses of the main version's chapter (KJV Malachi 3
 * and 4 for LSG Malachi 3), or undefined when the column reads the same chapter number.
 */
export const getParallelColumnChapters = ({
  book,
  chapter,
  mainVersion,
  columnVersion,
}: ParallelColumnChapterRequest): number[] | undefined => {
  const numbering = getParallelColumnNumbering(mainVersion, columnVersion)
  if (!numbering) return undefined
  const lastVerse = lastVerseOfChapter(numbering.main, book, chapter)
  if (lastVerse === undefined) return undefined
  const chapters = new Set<number>()
  const mainVerses = versesOfRange(numbering.main, {
    start: { book, chapter, verse: 0 },
    end: { book, chapter, verse: lastVerse },
  })
  for (const ref of mainVerses) {
    for (const verse of convertVerse(numbering.main, numbering.column, ref).verses) {
      if (verse.book === book) chapters.add(verse.chapter)
    }
  }
  return chapters.size > 0 ? [...chapters].sort((a, b) => a - b) : undefined
}

// A verse that holds only a Psalm title (LSG Psalm 51:1 and 51:2)
const isTitleVerse = (numbering: VersificationId, ref: VerseRef) => {
  const pivot = toPivot(numbering, ref).verses
  return pivot.length > 0 && pivot.every(isPsalmTitleVerse)
}

/**
 * The verses of `to` that show a verse of `from`. A title verse has no equivalent in a verse that
 * holds more than the title (LSG Psalm 51:1 against KJV 51:1), as in parallel reading.
 */
const correspondingVerseKeys = (key: string, from: VersificationId, to: VersificationId) => {
  const ref = parseVerseKey(key)
  if (!ref || !versificationHasVerse(from, ref)) return [key]
  const verses = convertVerse(from, to, ref).verses
  return (isTitleVerse(from, ref) ? verses.filter(verse => isTitleVerse(to, verse)) : verses).map(
    formatVerseKey
  )
}

const toVerseRef = (verse: Pick<Verse, 'Livre' | 'Chapitre' | 'Verset'>): VerseRef => ({
  book: Number(verse.Livre),
  chapter: Number(verse.Chapitre),
  verse: Number(verse.Verset),
})

/**
 * Aligns the verses loaded for a column (from the chapters `getParallelColumnChapters` named)
 * with the main version's chapter. A column verse stands opposite the first main verse it
 * corresponds to in the chapter, a Psalm title left out when the verse holds more (KJV Psalm
 * 51:1 opposite LSG 51:3); the other main verses it covers are « continued », except a title
 * against a verse that holds more, which has no equivalent of its own (LSG Psalm 51:1-2
 * against the KJV). A verse 0 of the main version is never shown: what corresponds to it goes
 * with verse 1. Verses that correspond to another chapter are left out.
 */
export const alignParallelColumn = ({
  book,
  chapter,
  mainVersion,
  columnVersion,
  columnVerses,
}: ParallelColumnChapterRequest & { columnVerses: readonly Verse[] }):
  | { verses: Verse[]; alignment: ParallelColumnAlignment }
  | undefined => {
  const numbering = getParallelColumnNumbering(mainVersion, columnVersion)
  if (!numbering) return undefined

  const isTitle = (verse: number) => isTitleVerse(numbering.main, { book, chapter, verse })
  const versesByMainVerse: Record<string, string[]> = {}
  const continued = new Set<number>()
  const verses: Verse[] = []
  let previousHome: number | undefined

  for (const verse of columnVerses) {
    const ref = toVerseRef(verse)
    const correspondences = convertVerse(numbering.column, numbering.main, ref).verses
    const candidates = correspondences
      .filter(target => target.book === book && target.chapter === chapter)
      .map(target => target.verse)
      .filter(target => target !== 0)
    let home: number
    if (candidates.length > 0) {
      const content = candidates.filter(candidate => !isTitle(candidate))
      home = (content.length > 0 ? content : candidates)[0]
      for (const candidate of candidates) {
        if (candidate === home || (isTitle(candidate) && !isTitle(home))) continue
        continued.add(candidate)
      }
    } else if (
      correspondences.length > 0 &&
      correspondences.every(target => target.book === book && target.chapter === chapter)
    ) {
      // Only a verse 0 of the main chapter: shown with its verse 1
      home = 1
    } else if (correspondences.length === 0 && ref.book === book && ref.chapter === chapter) {
      // A verse the table does not know, in the chapter of the same number: after the one before
      home = previousHome ?? 1
    } else {
      continue
    }
    previousHome = home
    ;(versesByMainVerse[home] ??= []).push(formatVerseKey(ref))
    verses.push(verse)
  }

  return {
    verses,
    alignment: {
      book,
      chapter,
      versesByMainVerse,
      continuedMainVerses: [...continued]
        .filter(verse => !versesByMainVerse[verse])
        .sort((a, b) => a - b)
        .map(String),
    },
  }
}

// --- Version comparison ---------------------------------------------------------------------

/**
 * The verse keys that show, in a compared version, the verses selected in the source version, in
 * canonical order (LSG Malachi 3:19 is KJV Malachi 4:1); a Psalm title verse has none in a
 * version that numbers the title with the psalm's first words. Without a source version, or when either
 * numbering is unknown, the keys are kept: that is how comparison worked before conversion. An
 * empty list means the version has no equivalent.
 */
export const getCompareVerseKeys = (
  selectedVerseKeys: readonly string[],
  sourceVersion: string | undefined,
  versionId: string
): string[] => {
  if (!sourceVersion) return [...selectedVerseKeys]
  const from = bibleVersification(sourceVersion)
  const to = bibleVersification(versionId)
  const keys = new Set(
    selectedVerseKeys.flatMap(key =>
      from && to && from !== to
        ? correspondingVerseKeys(key, from, to)
        : convertVerseKey(key, from, to)
    )
  )
  return [...keys].sort((left, right) => {
    const leftRef = parseVerseKey(left)
    const rightRef = parseVerseKey(right)
    return leftRef && rightRef ? compareVerseRefs(leftRef, rightRef) : 0
  })
}

/** The number of verses of a chapter in a version's own numbering, when it is known. */
export const getVersionChapterVerseCount = (
  versionId: string | undefined,
  book: number,
  chapter: number
): number | undefined => {
  const numbering = versionId ? bibleVersification(versionId) : undefined
  return numbering ? lastVerseOfChapter(numbering, book, chapter) : undefined
}

// --- Personal data of aligned columns -------------------------------------------------------

/**
 * The verses aligned columns show from another chapter than the main one (KJV Malachi 4:1-6
 * beside LSG Malachi 3, all of LSG Joel 4 beside KJV Joel 3), by version: the reader loads the
 * personal data of the main chapter only.
 */
export const getAlignedVerseKeysOutsideChapter = (
  parallelVerses: readonly Pick<ParallelVerse, 'id' | 'verses' | 'alignment'>[],
  book: number,
  chapter: number
): Record<string, string[]> => {
  const keys: Record<string, string[]> = {}
  for (const { id, verses, alignment } of parallelVerses) {
    if (!alignment) continue
    for (const verse of verses) {
      // eslint-disable-next-line eqeqeq
      if (verse.Livre == book && verse.Chapitre == chapter) continue
      ;(keys[id] ??= []).push(formatVerseKey(toVerseRef(verse)))
    }
  }
  return keys
}

/** The main chapter's highlights, with those of the verses aligned columns show from others. */
export const withAlignedColumnHighlights = (
  chapterHighlights: HighlightsObj,
  allHighlights: HighlightsObj | undefined,
  outsideKeys: Record<string, string[]>
): HighlightsObj => {
  const extra = Object.values(outsideKeys)
    .flat()
    .filter(key => allHighlights?.[key] && !chapterHighlights[key])
  if (!extra.length || !allHighlights) return chapterHighlights
  return {
    ...chapterHighlights,
    ...Object.fromEntries(extra.map(key => [key, allHighlights[key]])),
  }
}

/**
 * The main chapter's word annotations, with those of the verses aligned columns show from other
 * chapters, in the column's version. Their texts are left out, as the chapter selector does.
 */
export const withAlignedColumnWordAnnotations = (
  chapterAnnotations: WordAnnotationsObj,
  allAnnotations: WordAnnotationsObj | undefined,
  outsideKeys: Record<string, string[]>
): WordAnnotationsObj => {
  if (!allAnnotations || !Object.keys(outsideKeys).length) return chapterAnnotations
  const keysByVersion = new Map(
    Object.entries(outsideKeys).map(([version, keys]) => [version, new Set(keys)])
  )
  let result = chapterAnnotations
  for (const [id, annotation] of Object.entries(allAnnotations)) {
    if (chapterAnnotations[id]) continue
    const keys = keysByVersion.get(annotation.version)
    if (!keys || !annotation.ranges.some(range => keys.has(range.verseKey))) continue
    if (result === chapterAnnotations) result = { ...chapterAnnotations }
    result[id] = {
      ...annotation,
      ranges: annotation.ranges.map(range => ({ ...range, text: '' })),
    }
  }
  return result
}
