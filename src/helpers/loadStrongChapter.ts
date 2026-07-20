import { SQLStrongTransaction } from '~helpers/getSQLTransaction'
import catchDatabaseError, { DatabaseError } from '~helpers/catchDatabaseError'
import { getStrongVerseTable } from './strongBookTables'

export interface StrongChapterRow {
  Livre: number
  Chapitre: number
  Verset: number
  Texte: string
}

const loadStrongChapter = (
  Livre: number,
  Chapitre: number
): Promise<StrongChapterRow[] | DatabaseError> => {
  const part = getStrongVerseTable(Livre)
  if (!part) return Promise.resolve([])

  return catchDatabaseError(async () => {
    const result = await SQLStrongTransaction<StrongChapterRow>(
      `SELECT *
            FROM ${part}
            WHERE LIVRE = ${Livre}
            AND CHAPITRE  = ${Chapitre}
            ORDER BY VERSET ASC`
    )
    return result
  })
}

export default loadStrongChapter
