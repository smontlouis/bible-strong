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
    SnackBar.show(
      "Base de données corrompue. Veuillez contacter le développeur ou réinstaller l'application",
      'danger'
    )
  }
}

export default loadStrongVerse
