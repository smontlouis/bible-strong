import books from '~assets/bible_versions/books-desc'
import { Verse } from '~common/types'
import i18n from '~i18n'

type VerseReference = Pick<Verse, 'Livre' | 'Chapitre' | 'Verset'> & Partial<Pick<Verse, 'Texte'>>
type VerseInput = VerseReference | string | null | undefined

const normalizeVerse = (verse: VerseInput): VerseReference | null => {
  if (!verse) {
    return null
  }

  if (typeof verse === 'string') {
    const [Livre, Chapitre, Verset] = verse.split('-')
    return { Livre, Chapitre, Verset, Texte: '' }
  }

  return verse
}

export default (inputVerses: VerseInput[]) => {
  const verses = inputVerses
    .map(normalizeVerse)
    .filter((verse): verse is VerseReference => Boolean(verse))

  if (!verses.length) {
    return { title: '', content: '' }
  }

  const content = verses.map(v => `${v.Texte}`).join(' ')

  const title: string = verses
    .map(v => Number(v.Verset))
    .reduce(
      (acc, v, i, array) => {
        if (v === array[i - 1] + 1 && v === array[i + 1] - 1) {
          // if suite > 2
          return acc
        }
        if (v === array[i - 1] + 1 && v !== array[i + 1] - 1) {
          // if endSuite
          return `${acc}-${v}`
        }
        if (array[i - 1] && v - 1 !== array[i - 1]) {
          // if not preceded by - 1
          return `${acc},${v}`
        }
        return acc + v
      },
      `${i18n.t(books[Number(verses[0].Livre) - 1]?.Nom)} ${verses[0].Chapitre}:`
    )

  return { title, content }
}
