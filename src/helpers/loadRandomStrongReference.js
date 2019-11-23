import { SQLStrongTransaction } from '~helpers/getSQLTransaction'
import catchDatabaseError from '~helpers/catchDatabaseError'

const loadRandomStrongReference = async book =>
  catchDatabaseError(async () => {
    const part = book > 39 ? 'Grec' : 'Hebreu'
    const result = await SQLStrongTransaction(
      `SELECT * FROM ${part} WHERE Code IN (SELECT Code FROM ${part} ORDER BY RANDOM() LIMIT 1)`
    )
    return result[0]
  })

export default loadRandomStrongReference
