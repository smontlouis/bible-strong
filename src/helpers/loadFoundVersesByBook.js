import Sentry from 'sentry-expo'
import SQLTransaction from '~helpers/SQLTransaction'
import SnackBar from '~common/SnackBar'

const loadFoundVersesByBook = async (book, reference) => {
  try {
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
  } catch (e) {
    SnackBar.show('Une erreur est survenue. Le développeur en a été informé.', 'danger')
    Sentry.captureException(e)
  }
}

export default loadFoundVersesByBook
