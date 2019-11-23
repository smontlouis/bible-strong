import { SQLNaveTransaction } from '~helpers/getSQLTransaction'
import catchDatabaseError from '~helpers/catchDatabaseError'

const loadNaveByRandom = async () =>
  catchDatabaseError(async () => {
    const result = await SQLNaveTransaction(
      'SELECT * FROM TOPICS WHERE name_lower IN (SELECT name_lower FROM TOPICS ORDER BY RANDOM() LIMIT 1)'
    )
    return result[0]
  })

export default loadNaveByRandom
