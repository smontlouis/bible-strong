import { SQLStrongTransaction } from '~helpers/getSQLTransaction'
import catchDatabaseError from '~helpers/catchDatabaseError'
import { memoizeWithLang } from './memoize'

const loadStrongVersesCount = memoizeWithLang('STRONG', (book: number, reference: string) =>
  catchDatabaseError(async () => {
    const part = book > 39 ? 'LSGSNT2' : 'LSGSAT2'
    const result = await SQLStrongTransaction(
      `SELECT count(*) as versesCount
      FROM ${part} 
      WHERE Texte LIKE '% ${reference} %' 
      OR Texte LIKE '%(${reference})%'
      OR Texte LIKE '% ${reference}.%'
      OR Texte LIKE '% ${reference},%'

      OR Texte LIKE '% 0${reference} %' 
      OR Texte LIKE '%(0${reference})%'
      OR Texte LIKE '% 0${reference}.%'
      OR Texte LIKE '% 0${reference},%'
    `
    )
    return result
  })
)

export default loadStrongVersesCount
