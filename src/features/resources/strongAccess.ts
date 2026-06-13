import { StrongReference, Verse } from '~common/types'
import type { DatabaseError } from '~helpers/catchDatabaseError'
import loadFirstFoundVerses from '~helpers/loadFirstFoundVerses'
import loadFoundVersesByBook, { FoundVerseRow } from '~helpers/loadFoundVersesByBook'
import loadLexiqueByLetter, { LexiqueRow } from '~helpers/loadLexiqueByLetter'
import loadLexiqueBySearch from '~helpers/loadLexiqueBySearch'
import loadRandomStrongReference from '~helpers/loadRandomStrongReference'
import loadStrongChapter, { StrongChapterRow } from '~helpers/loadStrongChapter'
import loadStrongReference from '~helpers/loadStrongReference'
import loadStrongReferences from '~helpers/loadStrongReferences'
import loadStrongVerse from '~helpers/loadStrongVerse'
import loadStrongVersesCount from '~helpers/loadStrongVersesCount'
import loadStrongVersesCountByBook, {
  VersesCountByBookRow,
} from '~helpers/loadStrongVersesCountByBook'
export { getStrongReferenceFamily, type StrongReferenceFamily } from './strongAccessModel'
export type { FoundVerseRow } from '~helpers/loadFoundVersesByBook'
export type { LexiqueRow } from '~helpers/loadLexiqueByLetter'
export type { VersesCountByBookRow } from '~helpers/loadStrongVersesCountByBook'

export type StrongVerseLocation = {
  Livre: number
  Chapitre: number
  Verset: number
}

export type StrongVerseText = {
  Texte: string
}

export type StrongVersesCount = {
  versesCount: number
}

export type StrongAccess = {
  loadChapter: (book: number, chapter: number) => Promise<StrongChapterRow[] | DatabaseError>
  loadReference: (
    reference: string,
    book: number
  ) => Promise<StrongReference | DatabaseError | undefined>
  loadReferences: (
    references: string[],
    book: number
  ) => Promise<StrongReference[] | string[] | DatabaseError>
  loadVerse: (location: StrongVerseLocation) => Promise<StrongVerseText | DatabaseError | undefined>
  loadVersesCount: (book: number, reference: string) => Promise<StrongVersesCount[] | DatabaseError>
  loadVersesCountByBook: (
    book: number,
    reference: string
  ) => Promise<VersesCountByBookRow[] | DatabaseError>
  loadFirstFoundVerses: (book: number, reference: string) => Promise<Verse[] | DatabaseError>
  loadFoundVersesByBook: (
    book: number,
    reference: string
  ) => Promise<FoundVerseRow[] | DatabaseError>
  listLexiconByLetter: (letter: string) => Promise<LexiqueRow[] | DatabaseError>
  searchLexicon: (searchValue: string) => Promise<LexiqueRow[] | DatabaseError>
  loadRandomReference: (book: number) => Promise<StrongReference | DatabaseError | undefined>
}

export const localStrongAccess: StrongAccess = {
  loadChapter: loadStrongChapter,
  loadReference: loadStrongReference,
  loadReferences: loadStrongReferences,
  loadVerse: loadStrongVerse,
  loadVersesCount: loadStrongVersesCount,
  loadVersesCountByBook: loadStrongVersesCountByBook,
  loadFirstFoundVerses,
  loadFoundVersesByBook,
  listLexiconByLetter: loadLexiqueByLetter,
  searchLexicon: loadLexiqueBySearch,
  loadRandomReference: loadRandomStrongReference,
}
