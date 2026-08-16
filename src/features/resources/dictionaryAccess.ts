import loadDictionnaireByLetter from '~helpers/loadDictionnaireByLetter'
import loadDictionnaireBySearch from '~helpers/loadDictionnaireBySearch'
import loadDictionnaireItem from '~helpers/loadDictionnaireItem'
import loadDictionnaireItemByRowId from '~helpers/loadDictionnaireItemByRowId'
import loadDictionnaireWords from '~helpers/loadDictionnaireWords'
import { mapLocalResourceError, unwrapLocalResourceResult } from './resourceAccessError'
import { getLocalResourceAvailability } from './resourceAvailability'
import type { ResourceLanguage } from '~helpers/databaseTypes'
import type { ResourceAvailability } from './resourceModel'

export type DictionarySummary = {
  id: number
  word: string
  normalizedWord: string
}

export type DictionaryEntry = {
  word: string
  definition: string
}

export type DictionaryWordReference = { word: string }

export type DictionaryAccess = {
  getAvailability?: (language: ResourceLanguage) => Promise<ResourceAvailability>
  listByLetter: (letter: string) => Promise<DictionarySummary[]>
  search: (searchValue: string) => Promise<DictionarySummary[]>
  loadItem: (word: string) => Promise<DictionaryEntry | undefined>
  loadItemByRowId: (id: number | string) => Promise<DictionaryWordReference | undefined>
  loadWordsForVerse: (verseId: string) => Promise<string[]>
}

export const localDictionaryAccess: DictionaryAccess = {
  getAvailability: async language => {
    const availability = await getLocalResourceAvailability({
      kind: 'database',
      databaseId: 'DICTIONNAIRE',
      language,
    })
    return availability.status === 'available'
      ? { status: 'available' }
      : availability.status === 'corrupt'
        ? {
            status: 'unavailable',
            reason: 'invalid-offline-copy',
            recoveries: ['acquire-offline-copy', 'manage-offline-copies'],
          }
        : {
            status: 'unavailable',
            reason: 'offline-copy-required',
            recoveries: ['acquire-offline-copy'],
          }
  },
  listByLetter: async letter =>
    unwrapLocalResourceResult(await loadDictionnaireByLetter(letter)).map(item => ({
      id: item.rowid,
      word: item.word,
      normalizedWord: item.sanitized_word,
    })),
  search: async searchValue =>
    unwrapLocalResourceResult(await loadDictionnaireBySearch(searchValue)).map(item => ({
      id: item.rowid,
      word: item.word,
      normalizedWord: item.sanitized_word,
    })),
  loadItem: async word => {
    try {
      return await loadDictionnaireItem(word)
    } catch (error) {
      throw mapLocalResourceError(error)
    }
  },
  loadItemByRowId: async id => unwrapLocalResourceResult(await loadDictionnaireItemByRowId(id)),
  loadWordsForVerse: async verseId => {
    try {
      return await loadDictionnaireWords(verseId)
    } catch (error) {
      throw mapLocalResourceError(error)
    }
  },
}
