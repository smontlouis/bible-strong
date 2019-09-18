import SQLDTransaction from '~helpers/SQLDTransaction'
import catchDatabaseError from '~helpers/catchDatabaseError'

const loadDictionnaireItem = async id =>
  catchDatabaseError(async () => {
    const result = await SQLDTransaction(`SELECT word FROM dictionnaire WHERE id = ${id}`)
    return result[0]
  })

export default loadDictionnaireItem
