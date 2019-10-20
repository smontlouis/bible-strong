import SQLITransaction from '~helpers/SQLITransaction'
import catchDatabaseError from '~helpers/catchDatabaseError'

const loadInterlineaireChapter = (Livre, Chapitre) =>
  catchDatabaseError(async () => {
    const result = await SQLITransaction(
      `SELECT * 
            FROM INTERLINEAIRE
            WHERE LIVRE = ${Livre}
            AND CHAPITRE  = ${Chapitre}`
    )
    return result
  })

export default loadInterlineaireChapter
