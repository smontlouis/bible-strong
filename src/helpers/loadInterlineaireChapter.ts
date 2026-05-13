import { getSQLTransactionForLang } from '~helpers/getSQLTransaction'
import catchDatabaseError, { DatabaseError } from '~helpers/catchDatabaseError'
import { ResourceLanguage } from '~helpers/databaseTypes'

export interface InterlineaireRow {
  Livre: number
  Chapitre: number
  Verset: number
  [key: string]: string | number
}

const loadInterlineaireChapter = (
  Livre: number,
  Chapitre: number,
  lang: ResourceLanguage = 'fr'
): Promise<InterlineaireRow[] | DatabaseError> =>
  catchDatabaseError(async () => {
    const transaction = getSQLTransactionForLang('INTERLINEAIRE', lang)
    const result = await transaction<InterlineaireRow>(
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
