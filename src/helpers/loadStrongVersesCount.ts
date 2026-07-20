import { SQLStrongTransaction } from '~helpers/getSQLTransaction'
import catchDatabaseError from '~helpers/catchDatabaseError'
import { memoizeWithLang } from './memoize'
import { getStrongVerseTable } from './strongBookTables'

interface StrongVersesCountRow {
  versesCount: number
}

const loadStrongVersesCount = memoizeWithLang('STRONG', (book: number, reference: string) => {
  const part = getStrongVerseTable(book)
  if (!part) return Promise.resolve([])

  return catchDatabaseError(async () => {
    const result = await SQLStrongTransaction<StrongVersesCountRow>(
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
})

export default loadStrongVersesCount
