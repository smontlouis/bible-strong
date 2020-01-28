import { SQLNaveTransaction } from '~helpers/getSQLTransaction'
import catchDatabaseError from '~helpers/catchDatabaseError'

const loadNaveBySearch = searchValue =>
  catchDatabaseError(async () => {
    const result = await SQLNaveTransaction(
      `SELECT name_lower, name, letter
      FROM TOPICS 
      WHERE name LIKE (?)
      ORDER BY name ASC
      `,
      [`%${searchValue.trim()}%`]
    )

    return result
  })

export default loadNaveBySearch
