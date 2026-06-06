import type { Verse as TVerse } from '~common/types'
import type { BibleError } from '~helpers/bibleErrors'
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
}: {
  verseNumber: number
  isContextFocused: boolean
  hasFocusVerses: boolean
  isFocused?: boolean
  fadePosition?: FadePosition
}) => {
  void verseNumber
  return !(isContextFocused && hasFocusVerses && !isFocused && !fadePosition)
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

export const getParallelVerseRows = (
  index: number,
  parallelVerses: ParallelVerse[],
  verse: TVerse,
  version: string
): { version: string; verse: TVerse; error?: BibleError }[] => {
  const result: { version: string; verse: TVerse; error?: BibleError }[] = [{ version, verse }]

  parallelVerses.forEach(({ id, verses, error }) => {
    const parallelVerse = verses?.[index]
    result.push({
      version: id,
      verse: parallelVerse || { ...verse, Texte: '' },
      error,
    })
  })

  return result
}
