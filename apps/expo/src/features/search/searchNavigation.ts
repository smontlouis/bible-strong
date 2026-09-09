import type { BibleReferenceSegment } from '~helpers/bcvParser'
import { getBook } from '~helpers/bibleBookCatalog'

export { getBibleViewParamsForSearchResult } from '~features/studyRelations/openableStudyObjects'

export type { BibleReferenceSegment } from '~helpers/bcvParser'

export const getBibleViewParamsForReferenceSegment = (segment: BibleReferenceSegment) => ({
  contextDisplayMode: segment.isWholeChapter ? ('fullChapter' as const) : ('focused' as const),
  book: JSON.stringify(getBook(segment.book)),
  chapter: String(segment.chapter),
  verse: String(segment.startVerse),
  ...(segment.isWholeChapter
    ? {}
    : {
        focusVerses: JSON.stringify(
          Array.from(
            { length: segment.endVerse - segment.startVerse + 1 },
            (_, index) => segment.startVerse + index
          )
        ),
      }),
})
