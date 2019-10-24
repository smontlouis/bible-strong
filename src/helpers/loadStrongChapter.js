import SQLTransaction from '~helpers/SQLTransaction'
import catchDatabaseError from '~helpers/catchDatabaseError'

const loadStrongChapter = (Livre, Chapitre) =>
  catchDatabaseError(async () => {
    const part = Livre > 39 ? 'LSGSNT2' : 'LSGSAT2'
    const result = await SQLTransaction(
      `SELECT * 
            FROM ${part}
            WHERE LIVRE = ${Livre}
            AND CHAPITRE  = ${Chapitre}`
    )
    return result
  })

export default loadStrongChapter
