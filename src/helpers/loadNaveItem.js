import SQLNTransaction from '~helpers/SQLNTransaction'
import catchDatabaseError from '~helpers/catchDatabaseError'

const loadNaveItem = name_lower =>
  catchDatabaseError(async () => {
    const result = await SQLNTransaction(
      `SELECT name_lower, name, letter, description
    FROM TOPICS 
    WHERE name_lower LIKE '${name_lower}'
    `
    )

    return result[0]
  })

export default loadNaveItem
