import { SQLStrongTransaction } from '~helpers/getSQLTransaction'
import catchDatabaseError, { DatabaseError } from '~helpers/catchDatabaseError'

export interface VersesCountByBookRow {
  versesCountByBook: number
  Livre: number
}

const loadStrongVersesCountByBook = (
  book: number,
  reference: string
): Promise<VersesCountByBookRow[] | DatabaseError> =>
  catchDatabaseError(async () => {
    const part = book > 39 ? 'LSGSNT2' : 'LSGSAT2'
    const result = await SQLStrongTransaction<VersesCountByBookRow>(
      `SELECT count(*) as versesCountByBook, Livre
      FROM ${part}
      WHERE Texte LIKE '% ${reference} %'
      OR Texte LIKE '%(${reference})%'
      OR Texte LIKE '% ${reference}.%'
      OR Texte LIKE '% ${reference},%'

      OR Texte LIKE '% 0${reference} %'
      OR Texte LIKE '%(0${reference})%'
      OR Texte LIKE '% 0${reference}.%'
      OR Texte LIKE '% 0${reference},%'
      GROUP BY Livre
      ORDER BY Livre ASC
    `
    )
    return result
  })

export default loadStrongVersesCountByBook
