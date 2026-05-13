import { SQLStrongTransaction } from '~helpers/getSQLTransaction'
import catchDatabaseError, { DatabaseError } from '~helpers/catchDatabaseError'
import { StrongReference } from '~common/types'

const loadRandomStrongReference = async (
  book: number
): Promise<StrongReference | DatabaseError | undefined> =>
  catchDatabaseError(async () => {
    const part = book > 39 ? 'Grec' : 'Hebreu'
    const result = await SQLStrongTransaction<StrongReference>(
      `SELECT * FROM ${part} WHERE Code IN (SELECT Code FROM ${part} ORDER BY RANDOM() LIMIT 1)`
    )

    return result[0]
  })

export default loadRandomStrongReference
