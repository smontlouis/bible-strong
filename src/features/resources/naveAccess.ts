import type { DatabaseError } from '~helpers/catchDatabaseError'
import loadNaveByLetter, { type NaveLetterRow } from '~helpers/loadNaveByLetter'
import loadNaveByRandom, { type NaveRandomRow } from '~helpers/loadNaveByRandom'
import loadNaveBySearch, { type NaveSearchRow } from '~helpers/loadNaveBySearch'
import loadNaveByVerset from '~helpers/loadNaveByVerset'
import loadNaveItem, { type NaveItemRow } from '~helpers/loadNaveItem'

export type { NaveLetterRow } from '~helpers/loadNaveByLetter'
export type { NaveRandomRow } from '~helpers/loadNaveByRandom'
export type { NaveSearchRow } from '~helpers/loadNaveBySearch'
export type { NaveItemRow } from '~helpers/loadNaveItem'

export type NaveVerseTopicRow = {
  name: string
  name_lower: string
}

export type NaveVerseTopics = [NaveVerseTopicRow[] | undefined, NaveVerseTopicRow[] | undefined]

export type NaveAccess = {
  listByLetter: (letter: string) => Promise<NaveLetterRow[] | DatabaseError>
  search: (searchValue: string) => Promise<NaveSearchRow[] | DatabaseError>
  loadItem: (nameLower: string) => Promise<NaveItemRow | DatabaseError | undefined>
  loadByVerse: (verse: string) => Promise<NaveVerseTopics>
  loadRandom: () => Promise<NaveRandomRow | DatabaseError | undefined>
}

export const localNaveAccess: NaveAccess = {
  listByLetter: loadNaveByLetter,
  search: loadNaveBySearch,
  loadItem: loadNaveItem,
  loadByVerse: loadNaveByVerset,
  loadRandom: loadNaveByRandom,
}
