import Sentry from 'sentry-expo'
import SnackBar from '~common/SnackBar'

import SQLDTransaction from '~helpers/SQLDTransaction'

const loadDictionnaire = async () => {
  try {
    const result = await SQLDTransaction(
      `SELECT rowid, word, sanitized_word
    FROM dictionnaire 
    ORDER BY sanitized_word ASC
    `
    )

    return result
  } catch (e) {
    SnackBar.show('Une erreur est survenue. Le développeur en a été informé.', 'danger')
    Sentry.captureException(e)
  }
}

export default loadDictionnaire
