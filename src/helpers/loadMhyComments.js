import SQLMhyTransaction from '~helpers/SQLMhyTransaction'
import catchDatabaseError from '~helpers/catchDatabaseError'

const loadMhyComments = (book, chapter) =>
  catchDatabaseError(async () => {
    const result = await SQLMhyTransaction(
      `SELECT commentaires
            FROM COMMENTAIRES
            WHERE id = '${book}-${chapter}'`
    )
    return result[0]
  })

export default loadMhyComments
