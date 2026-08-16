import { getSQLTransactionForLang } from '~helpers/getSQLTransaction'
import catchDatabaseError from '~helpers/catchDatabaseError'
import memoize from './memoize'
import type { ResourceLanguage } from '~helpers/databaseTypes'
import { getResourceLanguage } from '~state/resourcesLanguage'

export interface NaveLetterRow {
  name_lower: string
  name: string
  letter: string
}

const loadNaveByLetterForLanguage = memoize((letter: string, language: ResourceLanguage) =>
  catchDatabaseError(async (): Promise<NaveLetterRow[]> => {
    const result = await getSQLTransactionForLang('NAVE', language)<NaveLetterRow>(
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

const loadNaveByLetter = (letter: string, language = getResourceLanguage('NAVE')) =>
  loadNaveByLetterForLanguage(letter, language)

export default loadNaveByLetter
