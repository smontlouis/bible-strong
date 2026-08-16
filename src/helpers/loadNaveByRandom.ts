import { getSQLTransactionForLang } from '~helpers/getSQLTransaction'
import catchDatabaseError, { DatabaseError } from '~helpers/catchDatabaseError'
import type { ResourceLanguage } from '~helpers/databaseTypes'
import { getResourceLanguage } from '~state/resourcesLanguage'

export interface NaveRandomRow {
  name_lower: string
  name: string
  letter: string
  description: string
}

const loadNaveByRandom = async (
  language: ResourceLanguage = getResourceLanguage('NAVE')
): Promise<NaveRandomRow | DatabaseError | undefined> =>
  catchDatabaseError(async () => {
    const result = await getSQLTransactionForLang(
      'NAVE',
      language
    )<NaveRandomRow>(
      'SELECT * FROM TOPICS WHERE name_lower IN (SELECT name_lower FROM TOPICS ORDER BY RANDOM() LIMIT 1)'
    )
    return result[0]
  })

export default loadNaveByRandom
