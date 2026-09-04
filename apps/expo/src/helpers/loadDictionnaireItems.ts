import { SQLDictionnaireTransaction } from '~helpers/getSQLTransaction'
import catchDatabaseError from '~helpers/catchDatabaseError.new'
import type { DictionaryItem } from './loadDictionnaireItem'

export type DictionaryBatchItem = DictionaryItem & { requestedWord: string }

const loadDictionnaireItems = async (words: readonly string[]): Promise<DictionaryBatchItem[]> => {
  const normalized = [
    ...new Set(words.map(word => word.trim().toLocaleLowerCase()).filter(Boolean)),
  ]
  if (normalized.length === 0) return []
  return catchDatabaseError(async () => {
    const rows = await SQLDictionnaireTransaction<DictionaryItem & { sanitized_word: string }>(
      `SELECT word, definition, sanitized_word
       FROM dictionnaire
       WHERE sanitized_word IN (${normalized.map(() => '?').join(', ')})
       ORDER BY id`,
      normalized
    )
    const firstByWord = new Map(rows.map(row => [row.sanitized_word, row]))
    return normalized.flatMap(requestedWord => {
      const item = firstByWord.get(requestedWord)
      return item ? [{ requestedWord, word: item.word, definition: item.definition }] : []
    })
  })
}

export default loadDictionnaireItems
