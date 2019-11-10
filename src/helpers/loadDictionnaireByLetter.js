import SQLDTransaction from '~helpers/SQLDTransaction'
import catchDatabaseError from '~helpers/catchDatabaseError'

const loadDictionnaireByLetter = letter =>
  catchDatabaseError(async () => {
    const result = await SQLDTransaction(
      `SELECT rowid, word, sanitized_word
    FROM dictionnaire
    WHERE sanitized_word LIKE '${letter}%'
    ORDER BY sanitized_word ASC
    `
    )

    return result
  })

export default loadDictionnaireByLetter
