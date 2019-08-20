import SQLDTransaction from '~helpers/SQLDTransaction'
import SnackBar from '~common/SnackBar'

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
    SnackBar.show(
      "Base de données corrompue. Veuillez contacter le développeur ou réinstaller l'application",
      'danger'
    )
  }
}

export default loadDictionnaire
