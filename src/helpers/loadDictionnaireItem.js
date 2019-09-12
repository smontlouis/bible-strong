import Sentry from 'sentry-expo'
import SQLDTransaction from '~helpers/SQLDTransaction'
import SnackBar from '~common/SnackBar'

const capitalize = string => string.charAt(0).toUpperCase() + string.slice(1)

const loadDictionnaireItem = async word => {
  try {
    const result = await SQLDTransaction(
      `SELECT word, definition FROM dictionnaire WHERE word = "${capitalize(
        word
      )}" OR sanitized_word = "${word}"`
    )
    return result[0]
  } catch (e) {
    SnackBar.show('Une erreur est survenue. Le développeur en a été informé.', 'danger')
    Sentry.captureException(e)
  }
}

export default loadDictionnaireItem
