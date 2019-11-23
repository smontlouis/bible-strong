import { SQLTresorTransaction } from '~helpers/getSQLTransaction'
import catchDatabaseError from '~helpers/catchDatabaseError'

const loadTresorCommentaires = verse =>
  catchDatabaseError(async () => {
    const result = await SQLTresorTransaction(
      `SELECT commentaires
            FROM COMMENTAIRES
            WHERE id = (?)`,
      [verse]
    )
    return result[0]
  })

export default loadTresorCommentaires
