import SQLTransaction from '~helpers/SQLTransaction'
import SnackBar from '~common/SnackBar'

const loadLexique = async () => {
  try {
    const resultGrec = await SQLTransaction(
      `SELECT Code, Grec, Mot, 'Grec' as lexiqueType
    FROM Grec 
    ORDER BY Mot ASC
    `
    )

    const resultHebreu = await SQLTransaction(
      `SELECT Code, Hebreu, Mot, 'Hébreu' as lexiqueType
    FROM Hebreu
    ORDER BY Mot ASC
    `
    )

    return [...resultGrec, ...resultHebreu]
      .filter(item => item.Mot)
      .sort((a, b) => {
        const nameA = a.Mot.toLowerCase()
        const nameB = b.Mot.toLowerCase()
        if (nameA < nameB) return -1
        if (nameA > nameB) return 1
        return 0
      })
  } catch (e) {
    SnackBar.show(
      "Base de données corrompue. Veuillez contacter le développeur ou réinstaller l'application",
      'danger'
    )
  }
}

export default loadLexique
