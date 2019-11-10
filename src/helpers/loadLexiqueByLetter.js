import SQLTransaction from '~helpers/SQLTransaction'
import catchDatabaseError from '~helpers/catchDatabaseError'

const loadLexiqueByLetter = letter =>
  catchDatabaseError(async () => {
    const resultGrec = await SQLTransaction(
      `SELECT Code, Grec, Mot, 'Grec' as lexiqueType
    FROM Grec 
    WHERE Mot LIKE '${letter}%'
    ORDER BY Mot ASC
    `
    )

    const resultHebreu = await SQLTransaction(
      `SELECT Code, Hebreu, Mot, 'Hébreu' as lexiqueType
    FROM Hebreu
    WHERE Mot LIKE '${letter}%'
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
  })

export default loadLexiqueByLetter
