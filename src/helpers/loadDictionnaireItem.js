import { SQLDictionnaireTransaction } from '~helpers/getSQLTransaction'
import catchDatabaseError from '~helpers/catchDatabaseError'

const capitalize = string => string.charAt(0).toUpperCase() + string.slice(1)

const loadDictionnaireItem = async word =>
  catchDatabaseError(async () => {
    const result = await SQLDictionnaireTransaction(
      `SELECT word, definition
      FROM dictionnaire
      WHERE word LIKE (?) OR sanitized_word LIKE (?)
      `,
      [`${capitalize(word)}`, `${word}`]
    )
    return result[0]
  })

export default loadDictionnaireItem
