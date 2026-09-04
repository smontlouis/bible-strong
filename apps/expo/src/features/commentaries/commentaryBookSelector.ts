import type { BibleTab, BibleTabActions } from '~state/tabs'

type CommentaryCoverage = {
  books: number[]
  chaptersByBook: Record<number, number[]>
}

type OpenBookSelector = (input: {
  actions: BibleTabActions
  data: BibleTab['data']
  coverage?: {
    books: number[]
    chaptersByBook: Record<number, number[]>
    verseCountByBookChapter: Record<string, number>
  }
}) => void

export const openCommentaryBookSelector = ({
  openBookSelector,
  actions,
  data,
  coverage,
}: {
  openBookSelector: OpenBookSelector
  actions: BibleTabActions
  data: BibleTab['data']
  coverage?: CommentaryCoverage
}) => {
  openBookSelector({
    actions,
    data,
    coverage: coverage
      ? {
          books: coverage.books,
          chaptersByBook: coverage.chaptersByBook,
          verseCountByBookChapter: {},
        }
      : undefined,
  })
}
