import { getSQLTransactionForLang } from '~helpers/getSQLTransaction'
import catchDatabaseError from '~helpers/catchDatabaseError'

const loadInterlineaireChapter = (Livre, Chapitre, lang = 'fr') =>
  catchDatabaseError(async () => {
    const transaction = getSQLTransactionForLang('INTERLINEAIRE', lang)
    const result = await transaction(
      `SELECT *
            FROM INTERLINEAIRE
            WHERE LIVRE = (?)
            AND CHAPITRE  = (?)
            ORDER BY VERSET ASC`,
      [Livre, Chapitre]
    )
    return result
  })

export default loadInterlineaireChapter
