import { SQLStrongTransaction } from '~helpers/getSQLTransaction'
import catchDatabaseError, { DatabaseError } from '~helpers/catchDatabaseError'
import { StrongReference } from '~common/types'

const loadStrongReference = async (
  reference: string,
  book: number
): Promise<StrongReference | DatabaseError | undefined> =>
  catchDatabaseError(async () => {
    const part = book > 39 ? 'Grec' : 'Hebreu'
    const result = await SQLStrongTransaction<StrongReference>(
      `SELECT * FROM ${part} WHERE Code = (?)`,
      [reference]
    )
    return result[0]
  })

export default loadStrongReference
