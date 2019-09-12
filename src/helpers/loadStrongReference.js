import Sentry from 'sentry-expo'
import SQLTransaction from '~helpers/SQLTransaction'
import SnackBar from '~common/SnackBar'

const loadStrongReference = async (reference, book) => {
  try {
    const part = book > 39 ? 'Grec' : 'Hebreu'
    const result = await SQLTransaction(`SELECT * FROM ${part} WHERE Code = ${reference}`)
    return result[0]
  } catch (e) {
    SnackBar.show('Une erreur est survenue. Le développeur en a été informé.', 'danger')
    Sentry.captureException(e)
  }
}

export default loadStrongReference
