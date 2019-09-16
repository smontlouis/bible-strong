import SQLTransaction from '~helpers/SQLTransaction'
import catchDatabaseError from '~helpers/catchDatabaseError'

const loadStrongReference = async (reference, book) =>
  catchDatabaseError(async () => {
    const part = book > 39 ? 'Grec' : 'Hebreu'
    const result = await SQLTransaction(`SELECT * FROM ${part} WHERE Code = ${reference}`)
    return result[0]
  })

export default loadStrongReference
