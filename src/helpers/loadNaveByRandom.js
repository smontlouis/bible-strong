import SQLNTransaction from '~helpers/SQLNTransaction'
import catchDatabaseError from '~helpers/catchDatabaseError'

const loadNaveByRandom = async () =>
  catchDatabaseError(async () => {
    const result = await SQLNTransaction(
      'SELECT * FROM TOPICS WHERE name_lower IN (SELECT name_lower FROM TOPICS ORDER BY RANDOM() LIMIT 1)'
    )
    return result[0]
  })

export default loadNaveByRandom
