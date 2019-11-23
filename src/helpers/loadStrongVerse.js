import { SQLStrongTransaction } from '~helpers/getSQLTransaction'
import catchDatabaseError from '~helpers/catchDatabaseError'

const loadStrongVerse = ({ Livre, Chapitre, Verset }) =>
  catchDatabaseError(async () => {
    const part = Livre > 39 ? 'LSGSNT2' : 'LSGSAT2'
    const result = await SQLStrongTransaction(
      `SELECT Texte 
            FROM ${part}
            WHERE LIVRE = ${Livre}
            AND CHAPITRE  = ${Chapitre}
            AND VERSET = ${Verset}`
    )
    return result[0]
  })

export default loadStrongVerse
