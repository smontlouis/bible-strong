import { getBook } from '~helpers/bibleBookCatalog'
import { osisToBibleReferenceTarget } from '~helpers/bcvParser'

export const getCommentaryBibleViewRoute = (osis: string) => {
  const target = osisToBibleReferenceTarget(osis)
  if (!target) return undefined

  return {
    pathname: '/bible-view' as const,
    params: {
      contextDisplayMode: 'focused' as const,
      book: JSON.stringify(getBook(target.book)),
      chapter: String(target.chapter),
      verse: String(target.verse),
      ...(target.focusVerses ? { focusVerses: JSON.stringify(target.focusVerses) } : {}),
    },
  }
}
