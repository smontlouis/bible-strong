import SQLTransaction from '~helpers/SQLTransaction'
import SnackBar from '~common/SnackBar'

const loadStrongVersesCountByBook = async (book, reference) => {
  try {
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
  } catch (e) {
    SnackBar.show(
      "Base de données corrompue. Veuillez contacter le développeur ou réinstaller l'application",
      'danger'
    )
  }
}

export default loadStrongVersesCountByBook
