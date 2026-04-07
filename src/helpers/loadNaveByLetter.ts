import { SQLNaveTransaction } from '~helpers/getSQLTransaction'
import catchDatabaseError from '~helpers/catchDatabaseError'
import { memoizeWithLang } from './memoize'

export interface NaveLetterRow {
  name_lower: string
  name: string
  letter: string
}

const loadNaveByLetter = memoizeWithLang('NAVE', (letter: string) =>
  catchDatabaseError(async (): Promise<NaveLetterRow[]> => {
    const result = await SQLNaveTransaction<NaveLetterRow>(
      `SELECT name_lower, name, letter
      FROM TOPICS
      WHERE letter LIKE (?)
      ORDER BY name ASC
      `,
      [letter]
    )

    return result
  })
)

export default loadNaveByLetter
