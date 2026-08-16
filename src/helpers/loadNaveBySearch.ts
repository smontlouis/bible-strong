import { getSQLTransactionForLang } from '~helpers/getSQLTransaction'
import catchDatabaseError, { DatabaseError } from '~helpers/catchDatabaseError'
import type { ResourceLanguage } from '~helpers/databaseTypes'
import { getResourceLanguage } from '~state/resourcesLanguage'

export interface NaveSearchRow {
  name_lower: string
  name: string
  letter: string
}

const loadNaveBySearch = (
  searchValue: string,
  language: ResourceLanguage = getResourceLanguage('NAVE')
): Promise<NaveSearchRow[] | DatabaseError> =>
  catchDatabaseError(async () => {
    const result = await getSQLTransactionForLang('NAVE', language)<NaveSearchRow>(
      `SELECT name_lower, name, letter
      FROM TOPICS
      WHERE name LIKE (?)
      ORDER BY name ASC
      `,
      [`%${searchValue.trim()}%`]
    )

    return result
  })

export default loadNaveBySearch
