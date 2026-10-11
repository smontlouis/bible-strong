import type { BiblePlanPassage } from '~state/tabs'

type Location = { book: number; chapter: number }

const isInBook = (passage: BiblePlanPassage, { book }: Location) => passage.book === book

/** Outside plan mode every chapter is reachable; the Bible itself sets the limits. */
export const canGoToPreviousPlanChapter = (
  passage: BiblePlanPassage | undefined,
  location: Location
): boolean => !passage || (isInBook(passage, location) && location.chapter > passage.startChapter)

export const canGoToNextPlanChapter = (
  passage: BiblePlanPassage | undefined,
  location: Location
): boolean => !passage || (isInBook(passage, location) && location.chapter < passage.endChapter)

export const isInPlanPassage = (
  passage: BiblePlanPassage | undefined,
  location: Location
): boolean =>
  !passage ||
  (isInBook(passage, location) &&
    location.chapter >= passage.startChapter &&
    location.chapter <= passage.endChapter)

/** Where the reader stands in a passage of several chapters, e.g. 2 of 3. */
export const getPlanPassagePosition = (
  passage: BiblePlanPassage,
  chapter: number
): { current: number; total: number } | undefined => {
  const total = passage.endChapter - passage.startChapter + 1
  const current = chapter - passage.startChapter + 1
  return total > 1 && current >= 1 && current <= total ? { current, total } : undefined
}
