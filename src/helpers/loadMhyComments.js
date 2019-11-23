import { SQLMHYTransaction } from '~helpers/getSQLTransaction'
import catchDatabaseError from '~helpers/catchDatabaseError'

const loadMhyComments = (book, chapter) =>
  catchDatabaseError(async () => {
    const result = await SQLMHYTransaction(
      `SELECT commentaires
            FROM COMMENTAIRES
            WHERE id = (?)`,
      [`${book}-${chapter}`]
    )
    return result[0]
  })

export default loadMhyComments
