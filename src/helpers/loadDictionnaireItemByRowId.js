import { SQLDictionnaireTransaction } from '~helpers/getSQLTransaction'
import catchDatabaseError from '~helpers/catchDatabaseError'

const loadDictionnaireItem = async id =>
  catchDatabaseError(async () => {
    const result = await SQLDictionnaireTransaction(
      'SELECT word FROM dictionnaire WHERE id = (?)',
      [id]
    )
    return result[0]
  })

export default loadDictionnaireItem
