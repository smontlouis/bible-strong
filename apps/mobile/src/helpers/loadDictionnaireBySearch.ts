import { SQLDictionnaireTransaction } from '~helpers/getSQLTransaction'
import catchDatabaseError, { DatabaseError } from '~helpers/catchDatabaseError'
import { decodeDictionaryPageCursor } from '~helpers/resourcePageCursor'

export interface DictionnaireSearchRow {
  rowid: number
  word: string
  sanitized_word: string
}

const loadDictionnaireBySearch = (
  searchValue: string,
  options: { limit?: number; cursor?: string } = {}
): Promise<DictionnaireSearchRow[] | DatabaseError> =>
  catchDatabaseError(async () => {
    const limit = options.limit ?? 50
    const cursor = decodeDictionaryPageCursor(options.cursor)
    const result = await SQLDictionnaireTransaction<DictionnaireSearchRow>(
      `SELECT id AS rowid, word, sanitized_word
      FROM dictionnaire
      WHERE (word LIKE (?) OR sanitized_word LIKE (?))
        AND (? IS NULL OR sanitized_word > ? OR (sanitized_word = ? AND id > ?))
      ORDER BY sanitized_word ASC, id ASC
      LIMIT ?
      `,
      [
        `%${searchValue.trim()}%`,
        `%${searchValue.trim()}%`,
        cursor?.[0] ?? null,
        cursor?.[0] ?? '',
        cursor?.[0] ?? '',
        cursor?.[1] ?? 0,
        limit + 1,
      ]
    )

    return result
  })

export default loadDictionnaireBySearch
