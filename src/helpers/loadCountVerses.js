import SQLTransaction from '~helpers/SQLTransaction'
import catchDatabaseError from '~helpers/catchDatabaseError'

const loadCountVerses = (book, chapter) =>
  catchDatabaseError(async () => {
    const part = book > 39 ? 'LSGSNT2' : 'LSGSAT2'
    const result = await SQLTransaction(
      `SELECT count(*)  as versesInCurrentChapter
              FROM ${part}
              WHERE LIVRE = ${book}
              AND CHAPITRE  = ${chapter}`
    )

    return result[0]
  })

export default loadCountVerses
