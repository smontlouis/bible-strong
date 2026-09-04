import { getSQLTransactionForLang } from '~helpers/getSQLTransaction'
import catchDatabaseError, { DatabaseError } from '~helpers/catchDatabaseError'
import type { ResourceLanguage } from '~helpers/databaseTypes'
import { getResourceLanguage } from '~state/resourcesLanguage'
import { decodeNavePageCursor } from '~helpers/resourcePageCursor'

export interface NaveSearchRow {
  name_lower: string
  name: string
  letter: string
}

const loadNaveBySearch = (
  searchValue: string,
  language: ResourceLanguage = getResourceLanguage('NAVE'),
  options: { limit?: number; cursor?: string } = {}
): Promise<NaveSearchRow[] | DatabaseError> =>
  catchDatabaseError(async () => {
    const limit = options.limit ?? 50
    const cursor = decodeNavePageCursor(options.cursor)
    const result = await getSQLTransactionForLang('NAVE', language)<NaveSearchRow>(
      `SELECT name_lower, name, letter
      FROM TOPICS
      WHERE name LIKE (?)
        AND (? IS NULL OR name > ? OR (name = ? AND name_lower > ?))
      ORDER BY name ASC, name_lower ASC
      LIMIT ?
      `,
      [
        `%${searchValue.trim()}%`,
        cursor?.[0] ?? null,
        cursor?.[0] ?? '',
        cursor?.[0] ?? '',
        cursor?.[1] ?? '',
        limit + 1,
      ]
    )

    return result
  })

export default loadNaveBySearch
