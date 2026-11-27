import type { Verse as TVerse } from '~common/types'
import type { BibleError } from '~helpers/bibleErrors'
import type { InterlinearMode } from '~helpers/interlinearDisplayMode'
import { isInterlinearCapableBibleVersion } from '~helpers/interlinearBiblePublications'
import type { HighlightsObj, WordAnnotationsObj } from '~redux/modules/user'
import type { VerseTarget } from './AnnotationMode/verseTargets'
import type { ParallelVerse, RootStyles, TaggedVerse, WebViewProps } from './BibleDOMWrapper'

export type FadePosition = 'top' | 'bottom'

export const createVerseKey = (verse: Pick<TVerse, 'Livre' | 'Chapitre' | 'Verset'>) =>
  `${verse.Livre}-${verse.Chapitre}-${verse.Verset}`

export const getFocusVerseNumbers = (focusVerses: WebViewProps['focusVerses']) =>
  focusVerses ? focusVerses.map(Number) : null

export const getScrollTargetVerse = ({
  verseToScroll,
  contextDisplayMode,
  focusVerses,
}: {
  verseToScroll: number | undefined
  contextDisplayMode: WebViewProps['contextDisplayMode']
  focusVerses: WebViewProps['focusVerses']
}) => {
  // A focus shows its verses first: the reader starts at the top, whatever the verses.
  if (contextDisplayMode === 'focused' && focusVerses?.length) return 1

  return verseToScroll
}

export const getAdjacentFocusVerses = (focusVerseNumbers: number[] | null) =>
  focusVerseNumbers
    ? {
        prev: Math.min(...focusVerseNumbers) - 1,
        next: Math.max(...focusVerseNumbers) + 1,
      }
    : null

export const getFadePosition = (
  verseNumber: number,
  isContextFocused: boolean,
  adjacentVerses: { prev: number; next: number } | null
): FadePosition | undefined => {
  if (!isContextFocused || !adjacentVerses) return undefined
  if (verseNumber === adjacentVerses.prev) return 'top'
  if (verseNumber === adjacentVerses.next) return 'bottom'
  return undefined
}

export const isVerseDimmedInFocusedContext = ({
  verseKey,
  isContextFocused,
  focusVerseNumbers,
}: {
  verseKey: string
  isContextFocused: boolean
  focusVerseNumbers: number[] | null
}) => {
  if (!isContextFocused || !focusVerseNumbers?.length) return false

  const verseNumber = Number(verseKey.split('-')[2])
  return !focusVerseNumbers.includes(verseNumber)
}

export const shouldRenderVerseInFocusedContext = ({
  verseNumber,
  isContextFocused,
  hasFocusVerses,
  isFocused,
  fadePosition,
  hideAdjacentVerses = false,
}: {
  verseNumber: number
  isContextFocused: boolean
  hasFocusVerses: boolean
  isFocused?: boolean
  fadePosition?: FadePosition
  hideAdjacentVerses?: boolean
}) => {
  void verseNumber
  return !(
    isContextFocused &&
    hasFocusVerses &&
    !isFocused &&
    (hideAdjacentVerses || !fadePosition)
  )
}

export const getTaggedVersesByLastVerse = (taggedVerses: TaggedVerse[] | null | undefined) =>
  new Map(taggedVerses?.map(taggedVerse => [taggedVerse.lastVerse, taggedVerse] as const) ?? [])

export const getVersesWithWordAnnotations = (
  wordAnnotations: WordAnnotationsObj | undefined,
  version: string
) => {
  const verseKeys = new Set<string>()
  if (!wordAnnotations) return verseKeys

  Object.values(wordAnnotations).forEach(annotation => {
    if (annotation.version === version) {
      annotation.ranges.forEach(range => verseKeys.add(range.verseKey))
    }
  })

  return verseKeys
}

export const shouldHighlightOnlyVerseNumber = ({
  hasWordAnnotations,
  isStrongModeVerse,
}: {
  hasWordAnnotations?: boolean
  isStrongModeVerse?: boolean
}) => Boolean(hasWordAnnotations) || Boolean(isStrongModeVerse)

export type ParallelVerseRow = {
  version: string
  verse: TVerse
  error?: BibleError
  interlinearMode?: InterlinearMode
  // The version has no such verse (e.g. Acts 8:37 in the ESV)
  isMissing?: boolean
  // The version's chapter is still loading
  isLoading?: boolean
  // The column is numbered differently and aligned through the versification table: its
  // verses keep their own numbers, possibly from another chapter (KJV Malachi 4:1 opposite
  // LSG Malachi 3:19)
  isAligned?: boolean
  // Aligned column: every verse shown opposite this row's main verse, when there are several
  // (KJV Psalm 51:1 holds LSG 51:1-3); `verse` is the first
  verses?: TVerse[]
  // Aligned column: the verse opposite this row is shown in an earlier or later row, merged
  isContinued?: boolean
  // Aligned column: the cell's verses do not carry the row's number, so they show their own
  showsOwnNumber?: boolean
}

export type ParallelChapterRow = {
  verse: TVerse
  rows: ParallelVerseRow[]
}

const getVerseNumberKey = (verse: Pick<TVerse, 'Verset'>) => String(verse.Verset)

const createMissingVerse = ({ Livre, Chapitre, Verset }: TVerse): TVerse => ({
  Livre,
  Chapitre,
  Verset,
  Texte: '',
})

// Only numeric verse numbers are compared; anything else keeps its version's order
const isLowerVerseNumber = (a: string, b: string) => {
  const numberA = Number(a)
  const numberB = Number(b)
  return Number.isFinite(numberA) && Number.isFinite(numberB) && numberA < numberB
}

// Verse numbers of every version, each version's order kept: a verse only one version has
// goes after the verse that precedes it in that version and after any lower verse number.
const getParallelChapterVerseNumbers = (verseLists: TVerse[][]) => {
  const numbers: string[] = []
  const anchors = new Map<string, TVerse>()

  verseLists.forEach(verses => {
    let previousIndex = -1
    verses.forEach(verse => {
      const key = getVerseNumberKey(verse)
      const existingIndex = numbers.indexOf(key)
      if (existingIndex !== -1) {
        previousIndex = existingIndex
        return
      }
      previousIndex += 1
      while (previousIndex < numbers.length && isLowerVerseNumber(numbers[previousIndex], key)) {
        previousIndex += 1
      }
      numbers.splice(previousIndex, 0, key)
      anchors.set(key, verse)
    })
  })

  return numbers.map(key => anchors.get(key) as TVerse)
}

const sortedVerseNumbers = (numbers: string[]) => [...numbers].sort((a, b) => Number(a) - Number(b))

// The rows an aligned column asks for, as main verses: those its verses stand opposite and those
// they continue, so that a main verse the main text lacks still gets its row.
const getAlignedMainVerses = ({ alignment }: ParallelVerse): TVerse[] =>
  alignment
    ? sortedVerseNumbers([
        ...Object.keys(alignment.versesByMainVerse),
        ...alignment.continuedMainVerses,
      ]).map(verse => ({
        Livre: alignment.book,
        Chapitre: alignment.chapter,
        Verset: Number(verse),
        Texte: '',
      }))
    : []

const getAlignedCell = (
  parallel: ParallelVerse,
  versesByKey: Map<string, TVerse>,
  anchor: TVerse
): ParallelVerseRow => {
  const { id, error, interlinearMode, alignment } = parallel
  const key = getVerseNumberKey(anchor)
  const verses = (alignment?.versesByMainVerse[key] ?? [])
    .map(verseKey => versesByKey.get(verseKey))
    .filter((verse): verse is TVerse => Boolean(verse))
  const modeProps = getParallelVerseModeProps({ version: id, interlinearMode })
  if (!verses.length) {
    const isContinued = alignment?.continuedMainVerses.includes(key)
    return {
      version: id,
      verse: createMissingVerse(anchor),
      error,
      ...modeProps,
      isAligned: true,
      ...(error ? {} : isContinued ? { isContinued: true } : { isMissing: true }),
    }
  }
  const showsOwnNumber =
    verses.length > 1 ||
    verses.some(
      // eslint-disable-next-line eqeqeq
      verse => verse.Chapitre != anchor.Chapitre || verse.Verset != anchor.Verset
    )
  return {
    version: id,
    verse: verses[0],
    error,
    ...modeProps,
    isAligned: true,
    ...(verses.length > 1 ? { verses } : {}),
    ...(showsOwnNumber ? { showsOwnNumber: true } : {}),
  }
}

// Rows are aligned by verse number, not by position, so a verse one version omits
// leaves an empty row in that version instead of shifting every following verse.
// A column numbered differently (its `alignment`) is aligned through the versification
// table instead: one row per main verse, the column's corresponding verses opposite it.
export const getParallelChapterRows = (
  verses: TVerse[],
  parallelVerses: ParallelVerse[],
  version: string,
  interlinearMode?: InterlinearMode
): ParallelChapterRow[] => {
  const versesByNumber = (list: TVerse[] | undefined) =>
    new Map(list?.map(verse => [getVerseNumberKey(verse), verse] as const) ?? [])
  const versesByKey = (list: TVerse[] | undefined) =>
    new Map(list?.map(verse => [createVerseKey(verse), verse] as const) ?? [])
  const mainVersesByNumber = versesByNumber(verses)
  const parallelVersesByNumber = parallelVerses.map(parallel =>
    parallel.alignment ? versesByKey(parallel.verses) : versesByNumber(parallel.verses)
  )

  return getParallelChapterVerseNumbers([
    verses,
    ...parallelVerses.map(parallel =>
      parallel.alignment ? getAlignedMainVerses(parallel) : (parallel.verses ?? [])
    ),
  ]).map(anchor => {
    const key = getVerseNumberKey(anchor)
    const mainVerse = mainVersesByNumber.get(key)
    const verse = mainVerse || createMissingVerse(anchor)

    const rows: ParallelVerseRow[] = [
      {
        version,
        verse,
        ...getParallelVerseModeProps({ version, interlinearMode }),
        ...(mainVerse ? {} : { isMissing: true }),
      },
    ]

    parallelVerses.forEach((parallel, index) => {
      if (parallel.alignment) {
        rows.push(getAlignedCell(parallel, parallelVersesByNumber[index], anchor))
        return
      }
      const { id, error, interlinearMode, isLoading } = parallel
      const parallelVerse = parallelVersesByNumber[index].get(key)
      rows.push({
        version: id,
        verse: parallelVerse || createMissingVerse(anchor),
        error,
        ...getParallelVerseModeProps({ version: id, interlinearMode }),
        ...(isLoading ? { isLoading: true } : parallelVerse || error ? {} : { isMissing: true }),
      })
    })

    return { verse, rows }
  })
}

/**
 * The number a verse of a parallel cell shows: its own, with its chapter when the verse comes
 * from another chapter than the row's (« 4:1 » opposite LSG Malachi 3:19).
 */
export const getParallelCellVerseNumber = (
  verse: Pick<TVerse, 'Chapitre' | 'Verset'>,
  rowVerse: Pick<TVerse, 'Chapitre'>
) =>
  // eslint-disable-next-line eqeqeq
  verse.Chapitre == rowVerse.Chapitre ? String(verse.Verset) : `${verse.Chapitre}:${verse.Verset}`

/**
 * The main verse whose row shows a verse of an aligned column (KJV Psalm 51:2 is in the row of
 * LSG 51:4), or undefined when the version is not shown in an aligned column.
 */
export const getAlignedRowVerseNumber = (
  parallelVerses: readonly Pick<ParallelVerse, 'id' | 'alignment'>[] | undefined,
  version: string | undefined,
  verseKey: string
): number | undefined => {
  for (const { id, alignment } of parallelVerses ?? []) {
    if (id !== version || !alignment) continue
    for (const [mainVerse, verseKeys] of Object.entries(alignment.versesByMainVerse)) {
      if (verseKeys.includes(verseKey)) return Number(mainVerse)
    }
  }
  return undefined
}

type HighlightColor = keyof RootStyles['settings']['colors'][keyof RootStyles['settings']['colors']]

/** The personal Bible data of one verse in one parallel column, by the verse's own key. */
export interface ParallelVerseState {
  isSelected: boolean
  highlightedColor?: HighlightColor
  isTouched: boolean
  hasWordAnnotations: boolean
}

/**
 * The selection, highlight, touch and word annotations of a verse shown in a parallel column,
 * read at the verse's own key: an aligned column numbers its verses otherwise than the row
 * (ADR-0030, a column's personal data uses its own verse keys).
 */
export const getParallelVerseState = ({
  verse,
  version,
  column,
  annotationMode,
  selectedVerses,
  selectedVersesVersion,
  highlightedVerses,
  touchedVerse,
  versesWithWordAnnotationsByVersion,
}: {
  verse: Pick<TVerse, 'Livre' | 'Chapitre' | 'Verset'>
  version: string
  column: number
  annotationMode?: boolean
  selectedVerses: { [key: string]: boolean }
  selectedVersesVersion: string
  highlightedVerses: HighlightsObj
  touchedVerse?: VerseTarget | null
  versesWithWordAnnotationsByVersion: Map<string, Set<string>>
}): ParallelVerseState => {
  const key = createVerseKey(verse)
  return {
    isSelected:
      !annotationMode && selectedVersesVersion === version && Boolean(selectedVerses[key]),
    highlightedColor: annotationMode
      ? undefined
      : (highlightedVerses[key]?.color as HighlightColor | undefined),
    isTouched:
      touchedVerse?.verseKey === key &&
      touchedVerse.version === version &&
      (touchedVerse.column === undefined || touchedVerse.column === column),
    hasWordAnnotations: Boolean(versesWithWordAnnotationsByVersion.get(version)?.has(key)),
  }
}

export const getParallelVerseModeProps = ({
  version,
  interlinearMode,
}: {
  version: string
  interlinearMode?: InterlinearMode
}) =>
  isInterlinearCapableBibleVersion(version)
    ? { interlinearMode }
    : {
        interlinearMode: undefined,
      }
