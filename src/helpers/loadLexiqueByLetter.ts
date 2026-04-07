import { SQLStrongTransaction } from '~helpers/getSQLTransaction'
import catchDatabaseError from '~helpers/catchDatabaseError'
import { memoizeWithLang } from './memoize'

export interface LexiqueGrecRow {
  Code: number
  Grec: string
  Mot: string
  lexiqueType: 'Grec'
}

export interface LexiqueHebreuRow {
  Code: number
  Hebreu: string
  Mot: string
  lexiqueType: 'Hébreu'
}

export type LexiqueRow = LexiqueGrecRow | LexiqueHebreuRow

const loadLexiqueByLetter = memoizeWithLang('STRONG', (letter: string) =>
  catchDatabaseError(async (): Promise<LexiqueRow[]> => {
    const resultGrec = await SQLStrongTransaction<LexiqueGrecRow>(
      `SELECT Code, Grec, Mot, 'Grec' as lexiqueType
    FROM Grec
    WHERE Mot LIKE (?)
    ORDER BY Mot ASC
    `,
      [`${letter}%`]
    )

    const resultHebreu = await SQLStrongTransaction<LexiqueHebreuRow>(
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
        if (nameA < nameB) {
          return -1
        }
        if (nameA > nameB) {
          return 1
        }
        return 0
      })
  })
)

export default loadLexiqueByLetter
