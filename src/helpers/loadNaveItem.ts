import { SQLNaveTransaction } from '~helpers/getSQLTransaction'
import catchDatabaseError, { DatabaseError } from '~helpers/catchDatabaseError'

export interface NaveItemRow {
  name_lower: string
  name: string
  letter: string
  description: string
}

const loadNaveItem = (name_lower: string): Promise<NaveItemRow | DatabaseError | undefined> =>
  catchDatabaseError(async () => {
    const result = await SQLNaveTransaction<NaveItemRow>(
      `SELECT name_lower, name, letter, description
    FROM TOPICS
    WHERE name_lower LIKE (?)
    `,
      [name_lower]
    )

    return result[0]
  })

export default loadNaveItem
