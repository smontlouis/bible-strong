import type { Verse as TVerse } from '~common/types'
import type { BibleError } from '~helpers/bibleErrors'
import type { InterlinearMode } from '~helpers/interlinearDisplayMode'
import { isInterlinearCapableBibleVersion } from '~helpers/interlinearBiblePublications'
import type { WordAnnotationsObj } from '~redux/modules/user'
import type { ParallelVerse, TaggedVerse, WebViewProps } from './BibleDOMWrapper'

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
  if (contextDisplayMode === 'focused' && focusVerses?.length) {
    const focusVerseNumbers = focusVerses.map(Number).filter(Number.isFinite)
    if (focusVerseNumbers.length) {
      return Math.min(...focusVerseNumbers)
    }
  }

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

// Rows are aligned by verse number, not by position, so a verse one version omits
// leaves an empty row in that version instead of shifting every following verse.
export const getParallelChapterRows = (
  verses: TVerse[],
  parallelVerses: ParallelVerse[],
  version: string,
  interlinearMode?: InterlinearMode
): ParallelChapterRow[] => {
  const versesByNumber = (list: TVerse[] | undefined) =>
    new Map(list?.map(verse => [getVerseNumberKey(verse), verse] as const) ?? [])
  const mainVersesByNumber = versesByNumber(verses)
  const parallelVersesByNumber = parallelVerses.map(parallel => versesByNumber(parallel.verses))

  return getParallelChapterVerseNumbers([
    verses,
    ...parallelVerses.map(parallel => parallel.verses ?? []),
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

    parallelVerses.forEach(({ id, error, interlinearMode, isLoading }, index) => {
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
