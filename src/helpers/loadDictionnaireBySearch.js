import { SQLDictionnaireTransaction } from '~helpers/getSQLTransaction'
import catchDatabaseError from '~helpers/catchDatabaseError'

const loadDictionnaireBySearch = searchValue =>
  catchDatabaseError(async () => {
    const result = await SQLDictionnaireTransaction(
      `SELECT rowid, word, sanitized_word
      FROM dictionnaire
      WHERE word LIKE (?) OR sanitized_word LIKE (?)
      ORDER BY sanitized_word ASC
      `,
      [`%${searchValue.trim()}%`, `%${searchValue.trim()}%`]
    )

    return result
  })

export default loadDictionnaireBySearch
