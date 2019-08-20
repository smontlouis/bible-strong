import SQLTransaction from '~helpers/SQLTransaction'
import SnackBar from '~common/SnackBar'

const loadStrongReference = async (reference, book) => {
  try {
    const part = book > 39 ? 'Grec' : 'Hebreu'
    const result = await SQLTransaction(`SELECT * FROM ${part} WHERE Code = ${reference}`)
    return result[0]
  } catch (e) {
    SnackBar.show(
      "Base de données corrompue. Veuillez contacter le développeur ou réinstaller l'application",
      'danger'
    )
  }
}

export default loadStrongReference
