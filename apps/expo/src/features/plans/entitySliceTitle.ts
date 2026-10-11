import type { TFunction } from 'i18next'
import type { EntitySlice } from '~common/types'
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
