import { SQLDictionnaireTransaction } from '~helpers/getSQLTransaction'
import catchDatabaseError from '~helpers/catchDatabaseError'

const loadDictionnaireBySearch = searchValue =>
  console.log(searchValue) ||
  catchDatabaseError(async () => {
    const result = await SQLDictionnaireTransaction(
      `SELECT rowid, word, sanitized_word
      FROM dictionnaire
      WHERE word LIKE (?) OR sanitized_word LIKE (?)
      ORDER BY sanitized_word ASC
      `,
      [`%${searchValue}%`]
    )

    return result
  })

export default loadDictionnaireBySearch
