import { SQLStrongTransaction } from '~helpers/getSQLTransaction'
import catchDatabaseError, { DatabaseError } from '~helpers/catchDatabaseError'
import { StrongReference } from '~common/types'
import { getStrongLexiconTable } from './strongBookTables'

const loadRandomStrongReference = async (
  book: number
): Promise<StrongReference | DatabaseError | undefined> => {
  const part = getStrongLexiconTable(book)
  if (!part) return Promise.resolve(undefined)

  return catchDatabaseError(async () => {
    const result = await SQLStrongTransaction<StrongReference>(
      `SELECT * FROM ${part} WHERE Code IN (SELECT Code FROM ${part} ORDER BY RANDOM() LIMIT 1)`
    )

    return result[0]
  })
}

export default loadRandomStrongReference
