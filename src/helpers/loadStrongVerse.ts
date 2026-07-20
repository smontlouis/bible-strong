import { SQLStrongTransaction } from '~helpers/getSQLTransaction'
import catchDatabaseError from '~helpers/catchDatabaseError'
import { memoizeWithLang } from './memoize'
import { getStrongVerseTable } from './strongBookTables'

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
  ({ Livre, Chapitre, Verset }: StrongVerseParams) => {
    const part = getStrongVerseTable(Livre)
    if (!part) return Promise.resolve(undefined)

    return catchDatabaseError(async (): Promise<StrongVerseRow | undefined> => {
      const result = await SQLStrongTransaction<StrongVerseRow>(
        `SELECT Texte
            FROM ${part}
            WHERE LIVRE = ${Livre}
            AND CHAPITRE  = ${Chapitre}
            AND VERSET = ${Verset}`
      )
      return result[0]
    })
  }
)

export default loadStrongVerse
