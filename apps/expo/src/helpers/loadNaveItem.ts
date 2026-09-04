import { getSQLTransactionForLang } from '~helpers/getSQLTransaction'
import catchDatabaseError, { DatabaseError } from '~helpers/catchDatabaseError'
import type { ResourceLanguage } from '~helpers/databaseTypes'
import { getResourceLanguage } from '~state/resourcesLanguage'

export interface NaveItemRow {
  name_lower: string
  name: string
  letter: string
  description: string
}

const loadNaveItem = (
  name_lower: string,
  language: ResourceLanguage = getResourceLanguage('NAVE')
): Promise<NaveItemRow | DatabaseError | undefined> =>
  catchDatabaseError(async () => {
    const result = await getSQLTransactionForLang('NAVE', language)<NaveItemRow>(
      `SELECT name_lower, name, letter, description
    FROM TOPICS
    WHERE name_lower LIKE (?)
    `,
      [name_lower]
    )

    return result[0]
  })

export default loadNaveItem
