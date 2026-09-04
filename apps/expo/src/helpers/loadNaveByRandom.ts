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
    )<NaveRandomRow>(`SELECT * FROM TOPICS
      WHERE rowid >= (ABS(RANDOM()) % (SELECT COALESCE(MAX(rowid), 0) + 1 FROM TOPICS))
      ORDER BY rowid
      LIMIT 1`)
    return result[0]
  })

export default loadNaveByRandom
