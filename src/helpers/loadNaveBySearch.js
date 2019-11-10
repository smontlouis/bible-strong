import SQLNTransaction from '~helpers/SQLNTransaction'
import catchDatabaseError from '~helpers/catchDatabaseError'

const loadNaveBySearch = searchValue =>
  catchDatabaseError(async () => {
    const result = await SQLNTransaction(
      `SELECT name_lower, name, letter
    FROM TOPICS 
    WHERE name LIKE '%${searchValue}%'
    ORDER BY letter ASC
    `
    )

    return result
  })

export default loadNaveBySearch
