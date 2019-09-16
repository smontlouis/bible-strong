import SQLTransaction from '~helpers/SQLTransaction'
import catchDatabaseError from '~helpers/catchDatabaseError'

const loadFoundVersesByBook = (book, reference) =>
  catchDatabaseError(async () => {
    const part = book > 39 ? 'LSGSNT2' : 'LSGSAT2'
    const result = await SQLTransaction(
      `SELECT *
      FROM ${part} 
      WHERE (Texte LIKE '% ${reference} %' 
      OR Texte LIKE '%(${reference})%'
      OR Texte LIKE '% ${reference}.%'
      OR Texte LIKE '% ${reference},%'

      OR Texte LIKE '% 0${reference} %' 
      OR Texte LIKE '%(0${reference})%'
      OR Texte LIKE '% 0${reference}.%'
      OR Texte LIKE '% 0${reference},%')
      AND Livre = ${book}
    `
    )
    return result
  })

export default loadFoundVersesByBook
