import type { TFunction } from 'i18next'
import type { EntitySlice, ReadingSlice } from '~common/types'
import { chapterToReference } from '~helpers/chapterToReference'
import verseToReference from '~helpers/verseToReference'

/** The name of an element in the list of its day and at the top of its page. */
export const getEntitySliceTitle = (slice: EntitySlice, t: TFunction): string => {
  switch (slice.type) {
    case 'Chapter':
      return chapterToReference(slice.chapters)
    case 'Verse':
      return verseToReference(slice.verses, { isPlan: true })
    case 'Video':
    case 'Title':
      return slice.title
    case 'Image':
      return slice.alt || t('readingPlans.image')
    case 'Text':
      return slice.title || t('dailyReading.meditationHeading')
    default:
      return ''
  }
}

/** "Jour 12" or "Day 12" names a day by its number, which the screens already show. */
const isNumberedDayTitle = (title: string) => /^(jour|day)\s*\d+$/i.test(title.trim())

/** A day by its own title, or else by its passages: "Ésaïe 30:18-19, Jean 1:11-14". */
export const getReadingSliceLabel = (reading: ReadingSlice, t: TFunction): string => {
  if (reading.title && !isNumberedDayTitle(reading.title)) return reading.title
  const passages = reading.slices.filter(
    slice => slice.type === 'Chapter' || slice.type === 'Verse'
  )
  const named = passages.length ? passages : reading.slices.filter(slice => slice.type !== 'Title')
  return named
    .map(slice => getEntitySliceTitle(slice, t))
    .filter(Boolean)
    .join(', ')
}
