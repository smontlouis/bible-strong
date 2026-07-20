import { SQLStrongTransaction } from '~helpers/getSQLTransaction'
import catchDatabaseError, { DatabaseError } from '~helpers/catchDatabaseError'
import { getStrongVerseTable } from './strongBookTables'

export interface FoundVerseRow {
  Livre: number
  Chapitre: number
  Verset: number
  Texte: string
}

const loadFoundVersesByBook = (
  book: number,
  reference: string
): Promise<FoundVerseRow[] | DatabaseError> => {
  const part = getStrongVerseTable(book)
  if (!part) return Promise.resolve([])

  return catchDatabaseError(async () => {
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
}

export default loadFoundVersesByBook
