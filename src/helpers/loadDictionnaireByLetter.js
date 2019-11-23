import { SQLDictionnaireTransaction } from '~helpers/getSQLTransaction'
import catchDatabaseError from '~helpers/catchDatabaseError'

const loadDictionnaireByLetter = letter =>
  catchDatabaseError(async () => {
    const result = await SQLDictionnaireTransaction(
      `SELECT rowid, word, sanitized_word
      FROM dictionnaire
      WHERE sanitized_word LIKE (?)
      ORDER BY sanitized_word ASC
      `,
      [`${letter}%`]
    )

    return result
  })

export default loadDictionnaireByLetter
