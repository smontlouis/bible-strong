import { useTranslation } from 'react-i18next'
import books from '~assets/bible_versions/books-desc-2'
import { getVerseMeditationsId, type DailyCard } from './dailyReadingFormat'
import { useDailyEntry } from './useDailyReadings'
import { useVerseSwap } from './useVerseSwap'

/** The version each verse meditation is written on: the text its Strong words and questions quote. */
export const VERSE_MEDITATION_VERSIONS: Record<string, string> = {
  'verse-meditations-fr': 'LSG',
  'verse-meditations-en': 'BSB',
}

export type VerseCard = Extract<DailyCard, { type: 'verse' }>

/** `MAT.5.6`, `PSA.103.1-2` → the verse keys `book-chapter-verse` of the passage. */
export const getVerseKeys = (ref: string): string[] => {
  const [code, chapter, verses] = ref.split('.')
  const book = books.find(candidate => candidate[1] === code)?.[0]
  const [first, last = first] = (verses ?? '').split(/[-–]/).map(Number)
  if (!book || !Number(chapter) || !first || !last || last < first) return []
  return Array.from(
    { length: last - first + 1 },
    (_, index) => `${book}-${chapter}-${first + index}`
  )
}

/**
 * The verse meditation of a civil date in the reader's language: the day's own, or the one
 * « Changer de verset » chose for it.
 */
export const useVerseMeditation = (date: string) => {
  const { i18n } = useTranslation()
  const collectionId = getVerseMeditationsId(i18n.language)
  const version = VERSE_MEDITATION_VERSIONS[collectionId]
  const days = useDailyEntry(collectionId, date)
  const swap = useVerseSwap(days.collection, date)
  const current = useDailyEntry(collectionId, date, swap.swappedKey)
  const verse = current.entry?.cards.find((card): card is VerseCard => card.type === 'verse')
  return {
    ...current,
    collectionId,
    version,
    verse,
    canChangeVerse: Boolean(current.collection?.reserve.length),
    changeVerse: () => swap.change(current.key),
  }
}
