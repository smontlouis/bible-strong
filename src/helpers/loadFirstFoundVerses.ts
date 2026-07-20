import { SQLStrongTransaction } from '~helpers/getSQLTransaction'
import catchDatabaseError from '~helpers/catchDatabaseError'
import { Verse } from '~common/types'
import { getStrongVerseTable } from './strongBookTables'

const loadFoundVerses = (book: number, reference: string) => {
  const part = getStrongVerseTable(book)
  if (!part) return Promise.resolve([])

  return catchDatabaseError(async () => {
    const result = await SQLStrongTransaction<Verse>(
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
      LIMIT 15
    `
    )
    return result
  })
}

export default loadFoundVerses
