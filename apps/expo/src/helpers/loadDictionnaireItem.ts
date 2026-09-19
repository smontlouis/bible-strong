import { SQLDictionnaireTransaction } from '~helpers/getSQLTransaction'
import catchDatabaseError from '~helpers/catchDatabaseError.new'

const capitalize = (str: string) => str.charAt(0).toUpperCase() + str.slice(1)

export type DictionaryItem = {
  id?: number
  word: string
  definition: string
}

type DictionaryQuery = DictionaryItem[]
const loadDictionnaireItem = async (word: string) =>
  catchDatabaseError(async () => {
    const result: DictionaryQuery = await SQLDictionnaireTransaction(
      `SELECT id, word, definition
      FROM dictionnaire
      WHERE word LIKE (?) OR sanitized_word LIKE (?)
      `,
      [`${capitalize(word)}`, `${word}`]
    )
    return result[0]
  })

export default loadDictionnaireItem
