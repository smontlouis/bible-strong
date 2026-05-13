import { SQLNaveTransaction } from '~helpers/getSQLTransaction'
import catchDatabaseError, { DatabaseError } from '~helpers/catchDatabaseError'

export interface NaveSearchRow {
  name_lower: string
  name: string
  letter: string
}

const loadNaveBySearch = (searchValue: string): Promise<NaveSearchRow[] | DatabaseError> =>
  catchDatabaseError(async () => {
    const result = await SQLNaveTransaction<NaveSearchRow>(
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
