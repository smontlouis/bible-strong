import { SQLDictionnaireTransaction } from '~helpers/getSQLTransaction'
import catchDatabaseError, { DatabaseError } from '~helpers/catchDatabaseError'

export interface DictionnaireItemRow {
  word: string
}

const loadDictionnaireItem = async (
  id: number | string
): Promise<DictionnaireItemRow | DatabaseError | undefined> =>
  catchDatabaseError(async () => {
    const result = await SQLDictionnaireTransaction<DictionnaireItemRow>(
      'SELECT word FROM dictionnaire WHERE id = (?)',
      [id]
    )
    return result[0]
  })

export default loadDictionnaireItem
