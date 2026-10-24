import { useQueries } from '@tanstack/react-query'
import type { EntitySlice, ReadingSlice } from '~common/types'
import {
  defaultResourceAccess,
  type ResourceAccessRegistry,
} from '~features/resources/resourceAccess'
import { range } from '~helpers/range'
import { useDefaultBibleVersion } from '~state/useDefaultBibleVersion'
import { getEntitySliceKey, isReadableEntitySlice } from './planProgress'

/** Words read in a minute, for the time a reading takes. */
export const WORDS_PER_MINUTE = 200

/** What an element of a day weighs, and how it opens. */
export interface ElementSize {
  verses?: number
  words: number
  /** Its first line, for the row that lists it. */
  opening?: string
}

const clean = (text: string) =>
  text
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

export const countWords = (text: string): number => {
  const cleaned = clean(text)
  return cleaned ? cleaned.split(' ').length : 0
}

export const readingMinutes = (words: number): number =>
  Math.max(1, Math.ceil(words / WORDS_PER_MINUTE))

const passageSize = (texts: string[]): ElementSize => ({
  verses: texts.length,
  words: texts.reduce((sum, text) => sum + countWords(text), 0),
  opening: texts.length ? clean(texts[0]) : undefined,
})

/** A text's size needs no loading: its words are in the plan. */
export const getTextSize = (description: string): ElementSize => ({
  words: countWords(description),
  opening:
    description
      .split('\n')
      .map(clean)
      .find(line => line.length > 0) ?? undefined,
})

/** The verses of a passage of the plan in a version: "1|4-5" are chapters, "13|1:1-4" verses. */
export const loadPassageSize = async (
  slice: EntitySlice,
  version: string,
  resourceAccess: ResourceAccessRegistry = defaultResourceAccess
): Promise<ElementSize | null> => {
  if (slice.type === 'Chapter') {
    const match = /^(\d+)\|(\d+)(?:-(\d+))?$/.exec(slice.chapters)
    if (!match) return null
    const [, book, start, end = start] = match
    const chapters = await Promise.all(
      range(Number(start), Number(end)).map(chapter =>
        resourceAccess.bibleContent.loadChapter({ version, book: Number(book), chapter })
      )
    )
    const texts = chapters.flatMap(result =>
      result.success && result.data ? result.data.verses.map(verse => verse.Texte) : []
    )
    return texts.length ? passageSize(texts) : null
  }
  if (slice.type === 'Verse') {
    const match = /^(\d+)\|(\d+):(\d+)(?:-(\d+))?$/.exec(slice.verses)
    if (!match) return null
    const [, book, chapter, start, end = start] = match
    const verseKeys = range(Number(start), Number(end)).map(verse => `${book}-${chapter}-${verse}`)
    const texts = await resourceAccess.bibleContent.loadVerseTexts({ version, verseKeys })
    const found = verseKeys.map(key => texts[key]).filter((text): text is string => !!text)
    return found.length ? passageSize(found) : null
  }
  return null
}

const isPassage = (slice: EntitySlice) => slice.type === 'Chapter' || slice.type === 'Verse'

/**
 * Sizes of the elements of a day, by element key. Passages load their verses in the reader's
 * version, in the background; a video or an image has no size.
 */
export const useElementSizes = (reading?: ReadingSlice): Record<string, ElementSize> => {
  const version = useDefaultBibleVersion()
  const elements = (reading?.slices ?? []).flatMap((slice, index) =>
    reading && isReadableEntitySlice(slice)
      ? [{ slice, key: getEntitySliceKey(reading.id, slice, index) }]
      : []
  )
  const passages = elements.filter(({ slice }) => isPassage(slice))
  const results = useQueries({
    queries: passages.map(({ slice }) => ({
      queryKey: [
        'plan-element-size',
        version,
        slice.type === 'Chapter' ? slice.chapters : slice.type === 'Verse' ? slice.verses : '',
      ],
      queryFn: () => loadPassageSize(slice, version),
      staleTime: Infinity,
    })),
  })
  const sizes: Record<string, ElementSize> = {}
  passages.forEach(({ key }, index) => {
    const size = results[index]?.data
    if (size) sizes[key] = size
  })
  elements.forEach(({ slice, key }) => {
    if (slice.type === 'Text') sizes[key] = getTextSize(slice.description)
  })
  return sizes
}

/** The minutes a day takes, as the sum of the minutes shown on its elements. */
export const getDayMinutes = (sizes: Record<string, ElementSize>): number =>
  Object.values(sizes).reduce((sum, size) => sum + (size.words ? readingMinutes(size.words) : 0), 0)
