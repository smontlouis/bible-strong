import { SQLStrongTransaction } from '~helpers/getSQLTransaction'
import catchDatabaseError, { DatabaseError } from '~helpers/catchDatabaseError'
import { StrongReference } from '~common/types'
import { getStrongLexiconTable } from './strongBookTables'

const loadStrongReference = async (
  reference: string,
  book: number
): Promise<StrongReference | DatabaseError | undefined> => {
  const part = getStrongLexiconTable(book)
  if (!part) return Promise.resolve(undefined)

  return catchDatabaseError(async () => {
    const result = await SQLStrongTransaction<StrongReference>(
      `SELECT * FROM ${part} WHERE Code = (?)`,
      [reference]
    )
    return result[0]
  })
}

export default loadStrongReference
