import { SQLStrongTransaction } from '~helpers/getSQLTransaction'
import catchDatabaseError, { DatabaseError } from '~helpers/catchDatabaseError'
import { memoizeWithLang } from './memoize'
import { StrongReference } from '~common/types'
import { getStrongLexiconTable } from './strongBookTables'

const updateReferencesOrder = (
  result: StrongReference[] | DatabaseError,
  references: string[]
): StrongReference[] | string[] => {
  if (!Array.isArray(result)) {
    return references
  }
  const updatedResult: StrongReference[] = []
  references = [...new Set(references)] // deleting duplicate references
  references.map(ref => {
    const refCode = parseInt(ref)
    result.map(res => {
      if (refCode === (res.Code as unknown as number)) {
        updatedResult.push(res)
      } else {
        return false
      }
    })
  })
  if (updatedResult.length !== result.length) {
    return references
  }
  return updatedResult
}

const loadStrongReferences = memoizeWithLang(
  'STRONG',
  async (references: string[], book: number) => {
    const part = getStrongLexiconTable(book)
    if (!part) return []

    return catchDatabaseError(async () => {
      references = references.filter(n => n.trim())
      const sqlReq = references.reduce((sqlString, reference, index) => {
        sqlString += `Code = ${reference} `
        if (references.length - 1 !== index) {
          sqlString += 'OR '
        }
        return sqlString
      }, `SELECT * FROM ${part} WHERE `)

      const result = await SQLStrongTransaction<StrongReference>(sqlReq)
      return updateReferencesOrder(result, references)
    })
  }
)

export default loadStrongReferences
