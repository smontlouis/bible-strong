import { SQLInterlineaireTransaction } from '~helpers/getSQLTransaction'
import catchDatabaseError from '~helpers/catchDatabaseError'

const loadInterlineaireChapter = (Livre, Chapitre) =>
  catchDatabaseError(async () => {
    const result = await SQLInterlineaireTransaction(
      `SELECT * 
            FROM INTERLINEAIRE
            WHERE LIVRE = (?)
            AND CHAPITRE  = (?)`,
      [Livre, Chapitre]
    )
    return result
  })

export default loadInterlineaireChapter
