import { SQLTresorTransaction } from '~helpers/getSQLTransaction'
import catchDatabaseError from '~helpers/catchDatabaseError.new'

type TresorCommentaire = {
  id: string
  commentaires: string[]
}

const loadTresorCommentaires = (verse: string) =>
  catchDatabaseError(async () => {
    const result: TresorCommentaire[] = await SQLTresorTransaction(
      `SELECT commentaires
            FROM COMMENTAIRES
            WHERE id = (?)`,
      [verse]
    )
    return result[0]
  })

export default loadTresorCommentaires
