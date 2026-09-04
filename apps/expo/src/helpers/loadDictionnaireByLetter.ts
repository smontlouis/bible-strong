import { SQLDictionnaireTransaction } from '~helpers/getSQLTransaction'
import catchDatabaseError from '~helpers/catchDatabaseError'
import { decodeDictionaryPageCursor } from '~helpers/resourcePageCursor'
import { memoizeWithLang } from './memoize'

export interface DictionnaireLetterRow {
  rowid: number
  word: string
  sanitized_word: string
}

export type DictionaryPageOptions = { limit?: number; cursor?: string }

const loadDictionnaireByLetter = memoizeWithLang(
  'DICTIONNAIRE',
  (letter: string, options: DictionaryPageOptions = {}) =>
    catchDatabaseError(async (): Promise<DictionnaireLetterRow[]> => {
      const limit = options.limit ?? 50
      const cursor = decodeDictionaryPageCursor(options.cursor)
      const result = await SQLDictionnaireTransaction<DictionnaireLetterRow>(
        `SELECT id AS rowid, word, sanitized_word
      FROM dictionnaire
      WHERE sanitized_word >= ? AND sanitized_word < ?
        AND (? IS NULL OR sanitized_word > ? OR (sanitized_word = ? AND id > ?))
      ORDER BY sanitized_word ASC, id ASC
      LIMIT ?
      `,
        [
          letter,
          `${letter}\uffff`,
          cursor?.[0] ?? null,
          cursor?.[0] ?? '',
          cursor?.[0] ?? '',
          cursor?.[1] ?? 0,
          limit + 1,
        ]
      )

      return result
    })
)

export default loadDictionnaireByLetter
