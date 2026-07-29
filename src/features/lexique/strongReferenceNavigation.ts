import { osisToBibleReferenceTarget } from '~helpers/bcvParser'
import { getBook } from '~helpers/bibleBookCatalog'
import verseToReference from '~helpers/verseToReference'

export const formatStrongOsisReference = (osis: string): string => {
  const target = osisToBibleReferenceTarget(osis)
  if (!target) return osis

  const verses = target.focusVerses ?? [target.verse]
  return verseToReference({
    bookNum: target.book,
    chapterNum: target.chapter,
    verses,
  })
}

export const getBibleViewRouteForStrongOsisReference = (osis: string) => {
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
