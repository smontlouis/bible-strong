import { SQLDictionnaireTransaction } from '~helpers/getSQLTransaction'
import catchDatabaseError from '~helpers/catchDatabaseError.new'

type DictionaryRefQuery = {
  ref: string
}[]

const loadDictionnaireWords = async (v: string): Promise<string[]> =>
  catchDatabaseError(async () => {
    const result: DictionaryRefQuery = await SQLDictionnaireTransaction(
      `SELECT ref
      FROM verses
      WHERE id LIKE (?)
      `,
      [v]
    )

    // Defensive check: return empty array if no result found
    if (!result || !result[0]) {
      return []
    }

    const parsed: unknown = JSON.parse(result[0].ref)
    if (!Array.isArray(parsed)) return []

    return parsed
      .filter((word): word is string => typeof word === 'string')
      .map(word => word.toLowerCase())
  })

export default loadDictionnaireWords
