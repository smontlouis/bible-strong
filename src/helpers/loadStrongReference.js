import { SQLStrongTransaction } from '~helpers/getSQLTransaction'
import catchDatabaseError from '~helpers/catchDatabaseError'

const loadStrongReference = async (reference, book) =>
  catchDatabaseError(async () => {
    const part = book > 39 ? 'Grec' : 'Hebreu'
    const result = await SQLStrongTransaction(`SELECT * FROM ${part} WHERE Code = (?)`, [reference])
    return result[0]
  })

export default loadStrongReference
