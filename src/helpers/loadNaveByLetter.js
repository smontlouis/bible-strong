import { SQLNaveTransaction } from '~helpers/getSQLTransaction'
import catchDatabaseError from '~helpers/catchDatabaseError'
import memoize from './memoize'

const loadNaveByLetter = memoize(letter =>
  catchDatabaseError(async () => {
    const result = await SQLNaveTransaction(
      `SELECT name_lower, name, letter
      FROM TOPICS 
      WHERE letter LIKE (?)
      ORDER BY name ASC
      `,
      [letter]
    )

    return result
  })
)

export default loadNaveByLetter
