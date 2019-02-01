import SQLTransaction from '@helpers/SQLTransaction'

const loadStrongVersesCountByBook = async (book, reference) => {
  const part = book > 39 ? 'LSGSNT2' : 'LSGSAT2'
  const result = await SQLTransaction(
    `SELECT count(*) as versesCountByBook, Livre
      FROM ${part} 
      WHERE Texte LIKE '% ${reference} %' 
      OR Texte LIKE '%(${reference})%'
      OR Texte LIKE '% ${reference}.%'
      OR Texte LIKE '% ${reference},%'

      OR Texte LIKE '% 0${reference} %' 
      OR Texte LIKE '%(0${reference})%'
      OR Texte LIKE '% 0${reference}.%'
      OR Texte LIKE '% 0${reference},%'
      GROUP BY Livre
      ORDER BY Livre ASC 
    `
  )
  return result
}

export default loadStrongVersesCountByBook
