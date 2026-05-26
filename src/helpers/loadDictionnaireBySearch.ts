import { SQLDictionnaireTransaction } from '~helpers/getSQLTransaction'
import catchDatabaseError, { DatabaseError } from '~helpers/catchDatabaseError'

export interface DictionnaireSearchRow {
  rowid: number
  word: string
  sanitized_word: string
}

const loadDictionnaireBySearch = (
  searchValue: string
): Promise<DictionnaireSearchRow[] | DatabaseError> =>
  catchDatabaseError(async () => {
    const result = await SQLDictionnaireTransaction<DictionnaireSearchRow>(
      `SELECT id AS rowid, word, sanitized_word
      FROM dictionnaire
      WHERE word LIKE (?) OR sanitized_word LIKE (?)
      ORDER BY sanitized_word ASC
      `,
      [`%${searchValue.trim()}%`, `%${searchValue.trim()}%`]
    )

    return result
  })

export default loadDictionnaireBySearch
