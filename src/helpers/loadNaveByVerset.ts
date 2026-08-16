import { getSQLTransactionForLang } from '~helpers/getSQLTransaction'
import catchDatabaseError from '~helpers/catchDatabaseError.new'
import * as Sentry from '@sentry/react-native'
import type { ResourceLanguage } from '~helpers/databaseTypes'
import { getResourceLanguage } from '~state/resourcesLanguage'

type NaveRefQuery = {
  ref: string
}[]

type NaveTopicsQuery = {
  name: string
  name_lower: string
}[]

const fetchData = async (item: string, language: ResourceLanguage) => {
  const transaction = getSQLTransactionForLang('NAVE', language)
  const [itemResult]: NaveRefQuery = await transaction(
    `SELECT ref
          FROM VERSES
          WHERE id = ?`,
    [item]
  )

  if (!itemResult) {
    return
  }

  const refArray: string[] = JSON.parse(itemResult.ref)

  const verseSqlReq = `SELECT name_lower, name FROM TOPICS WHERE ${refArray
    .map(() => 'name_lower = ?')
    .join(' OR ')}`

  const result: Promise<NaveTopicsQuery> = transaction(verseSqlReq, refArray)

  return result
}

const loadNaveByVerset = (
  verse: string,
  language: ResourceLanguage = getResourceLanguage('NAVE')
) =>
  catchDatabaseError(
    async () => {
      // Fetch for verse
      const naveReferenceResultForVerse = await fetchData(verse, language)

      // Fetch for chapter
      const chapter = verse.split('-').slice(0, -1).join('-') // 1-1-1 => 1-1

      const naveReferenceResultForChapter = await fetchData(chapter, language)

      return [naveReferenceResultForVerse, naveReferenceResultForChapter] as [
        NaveTopicsQuery | undefined,
        NaveTopicsQuery | undefined,
      ]
    },
    () => {
      Sentry.withScope(scope => {
        scope.setExtra('verse', verse)
        Sentry.captureMessage('Nave issue')
      })
    }
  )

export default loadNaveByVerset
