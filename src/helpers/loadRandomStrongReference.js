import SQLTransaction from '~helpers/SQLTransaction'
import catchDatabaseError from '~helpers/catchDatabaseError'

const loadRandomStrongReference = async book =>
  catchDatabaseError(async () => {
    const part = book > 39 ? 'Grec' : 'Hebreu'
    const result = await SQLTransaction(
      `SELECT * FROM ${part} WHERE Code IN (SELECT Code FROM ${part} ORDER BY RANDOM() LIMIT 1)`
    )
    return result[0]
  })

export default loadRandomStrongReference
