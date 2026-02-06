import { SQLStrongTransaction } from '~helpers/getSQLTransaction'
import catchDatabaseError from '~helpers/catchDatabaseError'

const loadStrongChapter = (Livre, Chapitre) =>
  catchDatabaseError(async () => {
    const part = Livre > 39 ? 'LSGSNT2' : 'LSGSAT2'
    const result = await SQLStrongTransaction(
      `SELECT * 
            FROM ${part}
            WHERE LIVRE = ${Livre}
            AND CHAPITRE  = ${Chapitre}
            ORDER BY VERSET ASC`
    )
    return result
  })

export default loadStrongChapter
