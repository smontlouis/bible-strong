import { SQLStrongTransaction } from '~helpers/getSQLTransaction'
import catchDatabaseError from '~helpers/catchDatabaseError'

const loadStrongVersesCountByBook = (book, reference) =>
  catchDatabaseError(async () => {
    const part = book > 39 ? 'LSGSNT2' : 'LSGSAT2'
    const result = await SQLStrongTransaction(
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
