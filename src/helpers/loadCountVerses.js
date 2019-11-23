import { SQLStrongTransaction } from '~helpers/getSQLTransaction'
import catchDatabaseError from '~helpers/catchDatabaseError'

const loadCountVerses = (book, chapter) =>
  catchDatabaseError(async () => {
    const part = book > 39 ? 'LSGSNT2' : 'LSGSAT2'
    const result = await SQLStrongTransaction(
      `SELECT count(*)  as versesInCurrentChapter
              FROM ${part}
              WHERE LIVRE = (?)
              AND CHAPITRE  = (?)`,
      [book, chapter]
    )

    return result[0]
  })

export default loadCountVerses
