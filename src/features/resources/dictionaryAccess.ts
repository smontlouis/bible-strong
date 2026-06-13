import type { DatabaseError } from '~helpers/catchDatabaseError'
import loadDictionnaireByLetter, {
  type DictionnaireLetterRow,
} from '~helpers/loadDictionnaireByLetter'
import loadDictionnaireBySearch, {
  type DictionnaireSearchRow,
} from '~helpers/loadDictionnaireBySearch'
import loadDictionnaireItem, { type DictionaryItem } from '~helpers/loadDictionnaireItem'
import loadDictionnaireItemByRowId, {
  type DictionnaireItemRow,
} from '~helpers/loadDictionnaireItemByRowId'
import loadDictionnaireWords from '~helpers/loadDictionnaireWords'

export type { DictionnaireLetterRow } from '~helpers/loadDictionnaireByLetter'
export type { DictionnaireSearchRow } from '~helpers/loadDictionnaireBySearch'
export type { DictionaryItem } from '~helpers/loadDictionnaireItem'
export type { DictionnaireItemRow } from '~helpers/loadDictionnaireItemByRowId'

export type DictionaryAccess = {
  listByLetter: (letter: string) => Promise<DictionnaireLetterRow[] | DatabaseError>
  search: (searchValue: string) => Promise<DictionnaireSearchRow[] | DatabaseError>
  loadItem: (word: string) => Promise<DictionaryItem | undefined>
  loadItemByRowId: (id: number | string) => Promise<DictionnaireItemRow | DatabaseError | undefined>
  loadWordsForVerse: (verseId: string) => Promise<string[]>
}

export const localDictionaryAccess: DictionaryAccess = {
  listByLetter: loadDictionnaireByLetter,
  search: loadDictionnaireBySearch,
  loadItem: loadDictionnaireItem,
  loadItemByRowId: loadDictionnaireItemByRowId,
  loadWordsForVerse: loadDictionnaireWords,
}
