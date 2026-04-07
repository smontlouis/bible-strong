import { SQLStrongTransaction } from '~helpers/getSQLTransaction'
import catchDatabaseError from '~helpers/catchDatabaseError'
import { memoizeWithLang } from './memoize'

interface StrongVerseParams {
  Livre: number
  Chapitre: number
  Verset: number
}

interface StrongVerseRow {
  Texte: string
}

const loadStrongVerse = memoizeWithLang(
  'STRONG',
  ({ Livre, Chapitre, Verset }: StrongVerseParams) =>
    catchDatabaseError(async (): Promise<StrongVerseRow | undefined> => {
      const part = Livre > 39 ? 'LSGSNT2' : 'LSGSAT2'
      const result = await SQLStrongTransaction<StrongVerseRow>(
        `SELECT Texte
            FROM ${part}
            WHERE LIVRE = ${Livre}
            AND CHAPITRE  = ${Chapitre}
            AND VERSET = ${Verset}`
      )
      return result[0]
    })
)

export default loadStrongVerse
