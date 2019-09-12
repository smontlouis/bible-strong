import Sentry from 'sentry-expo'
import SQLTransaction from '~helpers/SQLTransaction'
import SnackBar from '~common/SnackBar'

const loadStrongVerse = async ({ Livre, Chapitre, Verset }) => {
  try {
    const part = Livre > 39 ? 'LSGSNT2' : 'LSGSAT2'
    const result = await SQLTransaction(
      `SELECT Texte 
            FROM ${part}
            WHERE LIVRE = ${Livre}
            AND CHAPITRE  = ${Chapitre}
            AND VERSET = ${Verset}`
    )
    return result[0]
  } catch (e) {
    SnackBar.show('Une erreur est survenue. Le développeur en a été informé.', 'danger')
    Sentry.captureException(e)
  }
}

export default loadStrongVerse
