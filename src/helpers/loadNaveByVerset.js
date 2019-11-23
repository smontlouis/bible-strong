import { SQLNaveTransaction } from '~helpers/getSQLTransaction'
import catchDatabaseError from '~helpers/catchDatabaseError'

const fetchData = async item => {
  const [itemResult] = await SQLNaveTransaction(
    `SELECT ref
          FROM VERSES
          WHERE id = '${item}'`
  )

  if (!itemResult) return

  const refArray = JSON.parse(itemResult.ref)

  const verseSqlReq = refArray.reduce((sqlString, name_lower, index) => {
    sqlString += `name_lower LIKE '${name_lower}' `
    if (refArray.length - 1 !== index) {
      sqlString += 'OR '
    }
    return sqlString
  }, 'SELECT name_lower, name FROM TOPICS WHERE ')

  return SQLNaveTransaction(verseSqlReq)
}

const loadNaveByVerset = verse =>
  catchDatabaseError(async () => {
    // Fetch for verse
    const naveReferenceResultForVerse = await fetchData(verse)

    // Fetch for chapter
    const chapter = verse
      .split('-')
      .slice(0, -1)
      .join('-') // 1-1-1 => 1-1

    const naveReferenceResultForChapter = await fetchData(chapter)

    return [naveReferenceResultForVerse, naveReferenceResultForChapter]
  })

export default loadNaveByVerset
