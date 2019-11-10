import SQLDTransaction from '~helpers/SQLDTransaction'
import catchDatabaseError from '~helpers/catchDatabaseError'

const loadDictionnaireBySearch = searchValue =>
  catchDatabaseError(async () => {
    const result = await SQLDTransaction(
      `SELECT rowid, word, sanitized_word
    FROM dictionnaire
    WHERE sanitized_word LIKE '%${searchValue}%'
    ORDER BY sanitized_word ASC
    `
    )

    return result
  })

export default loadDictionnaireBySearch
