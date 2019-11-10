import SQLNTransaction from '~helpers/SQLNTransaction'
import catchDatabaseError from '~helpers/catchDatabaseError'

const loadNaveByLetter = letter =>
  catchDatabaseError(async () => {
    const result = await SQLNTransaction(
      `SELECT name_lower, name, letter
    FROM TOPICS 
    WHERE letter LIKE '${letter}'
    ORDER BY letter ASC
    `
    )

    return result
  })

export default loadNaveByLetter
