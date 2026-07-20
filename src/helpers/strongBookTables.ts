import { getBookCorpus } from './bibleBookCatalog'

export type StrongReferenceFamily = 'hebrew' | 'greek'
export type StrongLexiconTable = 'Hebreu' | 'Grec'
export type StrongVerseTable = 'LSGSAT2' | 'LSGSNT2'

export const getStrongReferenceFamily = (book: number): StrongReferenceFamily | undefined => {
  const corpus = getBookCorpus(book)
  if (corpus === 'old') return 'hebrew'
  if (corpus === 'new') return 'greek'
  return undefined
}

export const getStrongLexiconTable = (book: number): StrongLexiconTable | undefined => {
  const family = getStrongReferenceFamily(book)
  if (family === 'hebrew') return 'Hebreu'
  if (family === 'greek') return 'Grec'
  return undefined
}

export const getStrongVerseTable = (book: number): StrongVerseTable | undefined => {
  const family = getStrongReferenceFamily(book)
  if (family === 'hebrew') return 'LSGSAT2'
  if (family === 'greek') return 'LSGSNT2'
  return undefined
}
