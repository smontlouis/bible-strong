import SQLTransaction from '~helpers/SQLTransaction'

const loadCountVerses = async (book, chapter) => {
  const part = book > 39 ? 'LSGSNT2' : 'LSGSAT2'
  const result = await SQLTransaction(
    `SELECT count(*)  as versesInCurrentChapter
            FROM ${part}
            WHERE LIVRE = ${book}
            AND CHAPITRE  = ${chapter}`
  )
  return result[0]
}

export default loadCountVerses
