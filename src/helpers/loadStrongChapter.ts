import { SQLStrongTransaction } from '~helpers/getSQLTransaction'
import catchDatabaseError, { DatabaseError } from '~helpers/catchDatabaseError'

export interface StrongChapterRow {
  Livre: number
  Chapitre: number
  Verset: number
  Texte: string
}

const loadStrongChapter = (
  Livre: number,
  Chapitre: number
): Promise<StrongChapterRow[] | DatabaseError> =>
  catchDatabaseError(async () => {
    const part = Livre > 39 ? 'LSGSNT2' : 'LSGSAT2'
    const result = await SQLStrongTransaction<StrongChapterRow>(
      `SELECT *
            FROM ${part}
            WHERE LIVRE = ${Livre}
            AND CHAPITRE  = ${Chapitre}
            ORDER BY VERSET ASC`
    )
    return result
  })

export default loadStrongChapter
