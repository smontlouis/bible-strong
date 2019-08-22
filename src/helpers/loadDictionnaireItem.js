import SQLDTransaction from '~helpers/SQLDTransaction'
import SnackBar from '~common/SnackBar'

const capitalize = string => string.charAt(0).toUpperCase() + string.slice(1)

const loadDictionnaireItem = async word => {
  try {
    const result = await SQLDTransaction(
      `SELECT word, definition FROM dictionnaire WHERE word = "${capitalize(word)}"`
    )
    return result[0]
  } catch (e) {
    SnackBar.show(
      "Base de données corrompue. Veuillez contacter le développeur ou réinstaller l'application",
      'danger'
    )
    console.log(e)
  }
}

export default loadDictionnaireItem
