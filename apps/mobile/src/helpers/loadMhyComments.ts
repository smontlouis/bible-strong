import { SQLMHYTransaction } from '~helpers/getSQLTransaction'
import catchDatabaseError, { DatabaseError } from '~helpers/catchDatabaseError'

export interface MhyCommentRow {
  commentaires: string
}

const loadMhyComments = (
  book: number,
  chapter: number
): Promise<MhyCommentRow | DatabaseError | undefined> =>
  catchDatabaseError(async () => {
    const result = await SQLMHYTransaction<MhyCommentRow>(
      `SELECT commentaires
            FROM COMMENTAIRES
            WHERE id = (?)`,
      [`${book}-${chapter}`]
    )
    return result[0]
  })

export default loadMhyComments
