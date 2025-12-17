import { SQLNaveTransaction } from '~helpers/getSQLTransaction'
import catchDatabaseError from '~helpers/catchDatabaseError.new'
import * as Sentry from '@sentry/react-native'

type NaveRefQuery = {
  ref: string
}[]

type NaveTopicsQuery = {
  name: string
  name_lower: string
}[]

const fetchData = async (item: string) => {
  const [itemResult]: NaveRefQuery = await SQLNaveTransaction(
    `SELECT ref
          FROM VERSES
          WHERE id = '${item}'`
  )

  if (!itemResult) {
    return
  }

  const refArray: string[] = JSON.parse(itemResult.ref)

  const verseSqlReq = refArray.reduce((sqlString, name_lower, index) => {
    sqlString += `name_lower LIKE '${name_lower}' `
    if (refArray.length - 1 !== index) {
      sqlString += 'OR '
    }
    return sqlString
  }, 'SELECT name_lower, name FROM TOPICS WHERE ')

  const result: Promise<NaveTopicsQuery> = SQLNaveTransaction(verseSqlReq)

  return result
}

const loadNaveByVerset = (verse: string) =>
  catchDatabaseError(
    async () => {
      // Fetch for verse
      const naveReferenceResultForVerse = await fetchData(verse)

      // Fetch for chapter
      const chapter = verse.split('-').slice(0, -1).join('-') // 1-1-1 => 1-1

      const naveReferenceResultForChapter = await fetchData(chapter)

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
