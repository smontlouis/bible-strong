import SQLDTransaction from '~helpers/SQLDTransaction'
import SnackBar from '~common/SnackBar'

const loadDictionnaireItem = async word => {
  try {
    const result = await SQLDTransaction(
      `SELECT definition FROM dictionnaire WHERE word = "${word}"`
    )
    return result[0]
  } catch (e) {
    SnackBar.show(
      "Base de données corrompue. Veuillez contacter le développeur ou réinstaller l'application",
      'danger'
    )
  }
}

export default loadDictionnaireItem
