import SQLDTransaction from '~helpers/SQLDTransaction'
import catchDatabaseError from '~helpers/catchDatabaseError'

const loadDictionnaire = () =>
  catchDatabaseError(async () => {
    const result = await SQLDTransaction(
      `SELECT rowid, word, sanitized_word
    FROM dictionnaire 
    ORDER BY sanitized_word ASC
    `
    )

    return result
  })

export default loadDictionnaire
