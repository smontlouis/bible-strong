import { SQLDictionnaireTransaction } from '~helpers/getSQLTransaction'
import catchDatabaseError from '~helpers/catchDatabaseError'

const loadDictionnaireWords = async v =>
  catchDatabaseError(async () => {
    const result = await SQLDictionnaireTransaction(
      `SELECT ref
      FROM verses
      WHERE id LIKE (?)
      `,
      [v]
    )
    return JSON.parse(result[0].ref)
  })

export default loadDictionnaireWords
