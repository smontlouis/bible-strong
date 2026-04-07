import { SQLStrongTransaction } from '~helpers/getSQLTransaction'
import catchDatabaseError, { DatabaseError } from '~helpers/catchDatabaseError'

export interface FoundVerseRow {
  Livre: number
  Chapitre: number
  Verset: number
  Texte: string
}

const loadFoundVersesByBook = (
  book: number,
  reference: string
): Promise<FoundVerseRow[] | DatabaseError> =>
  catchDatabaseError(async () => {
    const part = book > 39 ? 'LSGSNT2' : 'LSGSAT2'
    const result = await SQLStrongTransaction<FoundVerseRow>(
      `SELECT *
      FROM ${part}
      WHERE (Texte LIKE '% ${reference} %'
      OR Texte LIKE '%(${reference})%'
      OR Texte LIKE '% ${reference}.%'
      OR Texte LIKE '% ${reference},%'

      OR Texte LIKE '% 0${reference} %'
      OR Texte LIKE '%(0${reference})%'
      OR Texte LIKE '% 0${reference}.%'
      OR Texte LIKE '% 0${reference},%')
      AND Livre = ${book}
    `
    )
    return result
  })

export default loadFoundVersesByBook
