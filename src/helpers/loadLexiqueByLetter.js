import { SQLStrongTransaction } from '~helpers/getSQLTransaction'
import catchDatabaseError from '~helpers/catchDatabaseError'

const loadLexiqueByLetter = letter =>
  catchDatabaseError(async () => {
    const resultGrec = await SQLStrongTransaction(
      `SELECT Code, Grec, Mot, 'Grec' as lexiqueType
    FROM Grec 
    WHERE Mot LIKE (?)
    ORDER BY Mot ASC
    `,
      [`${letter}%`]
    )

    const resultHebreu = await SQLStrongTransaction(
      `SELECT Code, Hebreu, Mot, 'Hébreu' as lexiqueType
    FROM Hebreu
    WHERE Mot LIKE (?)
    ORDER BY Mot ASC
    `,
      [`${letter}%`]
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
