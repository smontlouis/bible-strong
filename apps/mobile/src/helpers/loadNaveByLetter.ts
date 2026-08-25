import { getSQLTransactionForLang } from '~helpers/getSQLTransaction'
import catchDatabaseError from '~helpers/catchDatabaseError'
import memoize from './memoize'
import type { ResourceLanguage } from '~helpers/databaseTypes'
import { getResourceLanguage } from '~state/resourcesLanguage'
import { decodeNavePageCursor } from '~helpers/resourcePageCursor'

export interface NaveLetterRow {
  name_lower: string
  name: string
  letter: string
}

export type NavePageOptions = { limit?: number; cursor?: string }

const loadNaveByLetterForLanguage = memoize(
  (letter: string, language: ResourceLanguage, options: NavePageOptions = {}) =>
    catchDatabaseError(async (): Promise<NaveLetterRow[]> => {
      const limit = options.limit ?? 50
      const cursor = decodeNavePageCursor(options.cursor)
      const result = await getSQLTransactionForLang('NAVE', language)<NaveLetterRow>(
        `SELECT name_lower, name, letter
      FROM TOPICS
      WHERE letter = ?
        AND (? IS NULL OR name > ? OR (name = ? AND name_lower > ?))
      ORDER BY name ASC, name_lower ASC
      LIMIT ?
      `,
        [
          letter,
          cursor?.[0] ?? null,
          cursor?.[0] ?? '',
          cursor?.[0] ?? '',
          cursor?.[1] ?? '',
          limit + 1,
        ]
      )

      return result
    })
)

const loadNaveByLetter = (
  letter: string,
  language = getResourceLanguage('NAVE'),
  options: NavePageOptions = {}
) => loadNaveByLetterForLanguage(letter, language, options)

export default loadNaveByLetter
