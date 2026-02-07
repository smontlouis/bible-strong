import { SQLStrongTransaction } from '~helpers/getSQLTransaction'
import catchDatabaseError from '~helpers/catchDatabaseError'

const STRONG_PREFIX_REGEX = /^([HG])(\d+)$/i

const loadLexiqueBySearch = searchValue =>
  catchDatabaseError(async () => {
    const trimmed = searchValue.trim()
    const prefixMatch = trimmed.match(STRONG_PREFIX_REGEX)

    let resultGrec = []
    let resultHebreu = []

    if (prefixMatch) {
      const lang = prefixMatch[1].toUpperCase()
      const code = prefixMatch[2]

      if (lang === 'G') {
        resultGrec = await SQLStrongTransaction(
          `SELECT Code, Grec, Mot, 'Grec' as lexiqueType
          FROM Grec
          WHERE Code = (?)
          ORDER BY Mot ASC`,
          [code]
        )
      } else {
        resultHebreu = await SQLStrongTransaction(
          `SELECT Code, Hebreu, Mot, 'Hébreu' as lexiqueType
          FROM Hebreu
          WHERE Code = (?)
          ORDER BY Mot ASC`,
          [code]
        )
      }
    } else {
      resultGrec = await SQLStrongTransaction(
        `SELECT Code, Grec, Mot, 'Grec' as lexiqueType
        FROM Grec
        WHERE Mot LIKE (?) or Code = (?)
        ORDER BY Mot ASC`,
        [`%${trimmed}%`, trimmed]
      )

      resultHebreu = await SQLStrongTransaction(
        `SELECT Code, Hebreu, Mot, 'Hébreu' as lexiqueType
        FROM Hebreu
        WHERE Mot LIKE (?) or Code = (?)
        ORDER BY Mot ASC`,
        [`%${trimmed}%`, trimmed]
      )
    }

    return [...resultGrec, ...resultHebreu]
      .filter(item => item.Mot)
      .sort((a, b) => {
        const nameA = a.Mot.toLowerCase()
        const nameB = b.Mot.toLowerCase()
        if (nameA < nameB) {
          return -1
        }
        if (nameA > nameB) {
          return 1
        }
        return 0
      })
  })

export default loadLexiqueBySearch
