import { SQLDictionnaireTransaction } from '~helpers/getSQLTransaction'
import catchDatabaseError from '~helpers/catchDatabaseError'
import { memoizeWithLang } from './memoize'

export interface DictionnaireLetterRow {
  rowid: number
  word: string
  sanitized_word: string
}

const loadDictionnaireByLetter = memoizeWithLang('DICTIONNAIRE', (letter: string) =>
  catchDatabaseError(async (): Promise<DictionnaireLetterRow[]> => {
    const result = await SQLDictionnaireTransaction<DictionnaireLetterRow>(
      `SELECT rowid, word, sanitized_word
      FROM dictionnaire
      WHERE sanitized_word LIKE (?)
      ORDER BY sanitized_word ASC
      `,
      [`${letter}%`]
    )

    return result
  })
)

export default loadDictionnaireByLetter
