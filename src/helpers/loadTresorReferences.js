import SQLTTransaction from '~helpers/SQLTTransaction'
import catchDatabaseError from '~helpers/catchDatabaseError'

const loadTresorCommentaires = verse =>
  catchDatabaseError(async () => {
    const result = await SQLTTransaction(
      `SELECT commentaires
            FROM COMMENTAIRES
            WHERE id = '${verse}'`
    )
    return result[0]
  })

export default loadTresorCommentaires
