import Sentry from 'sentry-expo'
import SQLTransaction from '~helpers/SQLTransaction'
import SnackBar from '~common/SnackBar'

const loadCountVerses = async (book, chapter) => {
  const part = book > 39 ? 'LSGSNT2' : 'LSGSAT2'
  try {
    const result = await SQLTransaction(
      `SELECT count(*)  as versesInCurrentChapter
              FROM ${part}
              WHERE LIVRE = ${book}
              AND CHAPITRE  = ${chapter}`
    )

    return result[0]
  } catch (e) {
    SnackBar.show('Une erreur est survenue. Le développeur en a été informé.', 'danger')
    Sentry.captureException(e)
  }
}

export default loadCountVerses
