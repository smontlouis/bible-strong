import { SQLNaveTransaction } from '~helpers/getSQLTransaction'
import catchDatabaseError, { DatabaseError } from '~helpers/catchDatabaseError'

export interface NaveRandomRow {
  name_lower: string
  name: string
  letter: string
  description: string
}

const loadNaveByRandom = async (): Promise<NaveRandomRow | DatabaseError | undefined> =>
  catchDatabaseError(async () => {
    const result = await SQLNaveTransaction<NaveRandomRow>(
      'SELECT * FROM TOPICS WHERE name_lower IN (SELECT name_lower FROM TOPICS ORDER BY RANDOM() LIMIT 1)'
    )
    return result[0]
  })

export default loadNaveByRandom
